/**
 * Prediction + Travel Mode + School Mode intelligence
 * Grounded on the live weather pack (no external ML API needed for demo).
 */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function hourLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true })
  } catch {
    return '--'
  }
}

/** Estimate visibility (km) when API doesn't send it */
export function estimateVisibility(wx) {
  if (wx.current?.visibility != null && Number.isFinite(wx.current.visibility)) {
    return wx.current.visibility
  }
  const code = wx.current.code
  const humidity = wx.current.humidity
  const rain = wx.current.precip || 0
  if (code >= 45 && code <= 48) return 0.4 // fog
  if (code >= 95) return 1.5
  if (code >= 65 || rain > 2) return 2.5
  if (code >= 61 || rain > 0.2) return 5
  if (humidity > 90) return 6
  if (humidity > 75) return 9
  return 12
}

/**
 * Multi-day weather PREDICTION narrative + confidence + peak risk hours
 */
export function buildPrediction(wx, lang = 'en') {
  const days = wx.daily || []
  const hourly = wx.hourly || []
  const city = lang === 'hi' ? wx.city.name_hi || wx.city.name : wx.city.name

  const peakRainDay = days.reduce((b, d) => (d.rain > (b?.rain || -1) ? d : b), null)
  const peakPopDay = days.reduce((b, d) => (d.pop > (b?.pop || -1) ? d : b), null)
  const hottest = days.reduce((b, d) => (d.max > (b?.max || -1) ? d : b), null)
  const coolest = days.reduce((b, d) => (d.min < (b?.min ?? 999) ? d : b), null)
  const stormy = days.filter((d) => d.code >= 95 || d.rain > 40 || d.pop >= 80)

  // Next 12h rain pulse
  const next12 = hourly.slice(0, 12)
  const wetHours = next12.filter((h) => h.pop >= 60 || h.rain > 0.3)
  const dryStretch = []
  let run = []
  for (const h of next12) {
    if (h.pop < 35 && h.rain < 0.1) {
      run.push(h)
    } else {
      if (run.length >= 2) dryStretch.push([...run])
      run = []
    }
  }
  if (run.length >= 2) dryStretch.push(run)
  const bestDry = dryStretch.sort((a, b) => b.length - a.length)[0]

  const trendRain =
    (days[1]?.rain || 0) + (days[2]?.rain || 0) > (days[0]?.rain || 0) * 1.4
      ? 'increasing'
      : (days[1]?.rain || 0) + (days[2]?.rain || 0) < (days[0]?.rain || 0) * 0.6
        ? 'easing'
        : 'steady'

  const conf = clamp(
    0.72 +
      (wx.live ? 0.1 : 0) +
      (days[0]?.pop > 70 || days[0]?.pop < 25 ? 0.06 : 0) -
      (stormy.length > 2 ? 0.05 : 0),
    0.65,
    0.94
  )

  const headline =
    lang === 'hi'
      ? stormy.length
        ? `${city}: अगले ${days.length} दिनों में अस्थिर / वर्षा-भारी पैटर्न संभावित`
        : trendRain === 'increasing'
          ? `${city}: बारिश का रुझान बढ़ता दिख रहा है`
          : trendRain === 'easing'
            ? `${city}: मौसम धीरे-साथ स्थिर / सूखा होता दिख रहा है`
            : `${city}: आगे के दिन अपेक्षाकृत स्थिर मौसम`
      : stormy.length
        ? `${city}: unsettled / rain-heavy pattern likely over the next ${days.length} days`
        : trendRain === 'increasing'
          ? `${city}: rainfall trend looks like it is building`
          : trendRain === 'easing'
            ? `${city}: conditions look like they are easing / drying out`
            : `${city}: relatively steady pattern ahead`

  const bullets =
    lang === 'hi'
      ? [
          peakRainDay
            ? `सबसे गीला दिन: **${peakRainDay.weekday_hi || peakRainDay.weekday}** (~${peakRainDay.rain} मिमी, ${peakRainDay.pop}% संभावना)`
            : null,
          peakPopDay && peakPopDay !== peakRainDay
            ? `सबसे ऊँची बारिश संभावना: **${peakPopDay.weekday_hi || peakPopDay.weekday}** (${peakPopDay.pop}%)`
            : null,
          hottest ? `सबसे गर्म: **${hottest.weekday_hi || hottest.weekday}** उच्च ${hottest.max}°C` : null,
          coolest ? `सबसे ठंडा न्यून: **${coolest.weekday_hi || coolest.weekday}** ${coolest.min}°C` : null,
          wetHours.length
            ? `अगले 12 घंटे: **${wetHours.length}** गीले/जोखिम वाले स्लॉट`
            : `अगले 12 घंटे: बड़े गीले स्लॉट कम`,
          bestDry
            ? `सूखा विंडो: roughly **${bestDry[0].label}–${bestDry[bestDry.length - 1].label}**`
            : `साफ लंबा सूखा विंडो सीमित — प्लान लचीला रखें`,
          stormy.length
            ? `तूफान/भारी वर्षा संकेत: **${stormy.length}** दिन(नों) पर नज़र`
            : `गंभीर तूफान संकेत कम`,
        ].filter(Boolean)
      : [
          peakRainDay
            ? `Wettest day: **${peakRainDay.weekday}** (~${peakRainDay.rain} mm, ${peakRainDay.pop}% chance)`
            : null,
          peakPopDay && peakPopDay !== peakRainDay
            ? `Highest rain probability: **${peakPopDay.weekday}** (${peakPopDay.pop}%)`
            : null,
          hottest ? `Hottest: **${hottest.weekday}** high ${hottest.max}°C` : null,
          coolest ? `Coolest night: **${coolest.weekday}** low ${coolest.min}°C` : null,
          wetHours.length
            ? `Next 12 hours: **${wetHours.length}** wet / higher-risk slots`
            : `Next 12 hours: few sustained wet slots`,
          bestDry
            ? `Clearer window: roughly **${bestDry[0].label}–${bestDry[bestDry.length - 1].label}**`
            : `No long dry window — keep plans flexible`,
          stormy.length
            ? `Storm / heavy-rain flags on **${stormy.length}** day(s)`
            : `Severe storm signals look limited`,
        ].filter(Boolean)

  const takeaway =
    lang === 'hi'
      ? stormy.length || (peakRainDay?.pop || 0) >= 70
        ? `**संक्षेप:** बाहरी काम और यात्रा को गीले शिखर से बचाकर प्लान करें; Alerts टैब पर रंग-कोड देखें।`
        : `**संक्षेप:** बड़े आश्चर्य की संभावना कम; फिर भी सुबह की खिड़कियाँ बाहरी काम के लिए बेहतर।`
      : stormy.length || (peakRainDay?.pop || 0) >= 70
        ? `**Bottom line:** Plan outdoor work and travel around the wet peaks; watch colour-coded Alerts.`
        : `**Bottom line:** Low surprise factor overall — morning windows still best for outdoor tasks.`

  return {
    headline,
    bullets,
    takeaway,
    confidence: conf,
    trendRain,
    peakRainDay,
    bestDryWindow: bestDry
      ? { start: bestDry[0].label, end: bestDry[bestDry.length - 1].label, hours: bestDry.length }
      : null,
    stormDays: stormy.length,
    series: days.map((d) => ({
      day: lang === 'hi' ? d.weekday_hi : d.weekday,
      rain: d.rain,
      pop: d.pop,
      max: d.max,
      min: d.min,
      risk: d.code >= 95 ? 90 : d.pop >= 80 ? 75 : d.pop >= 55 ? 50 : d.pop >= 30 ? 30 : 10,
    })),
  }
}

/**
 * TRAVEL MODE — visibility, rain/wind, road risk, safer windows
 */
export function buildTravelInsight(wx, lang = 'en') {
  const vis = estimateVisibility(wx)
  const wind = wx.current.wind || 0
  const pop0 = wx.daily[0]?.pop || 0
  const rain0 = wx.daily[0]?.rain || 0
  const code = wx.current.code
  const hours = wx.hourly || []

  // Road risk score 0-100
  let risk = 15
  if (vis < 1) risk += 40
  else if (vis < 3) risk += 28
  else if (vis < 5) risk += 15
  if (wind >= 40) risk += 25
  else if (wind >= 25) risk += 12
  if (pop0 >= 80 || rain0 > 30) risk += 25
  else if (pop0 >= 55 || rain0 > 10) risk += 14
  if (code >= 95) risk += 30
  else if (code >= 65) risk += 18
  risk = clamp(risk, 5, 98)

  const level =
    risk >= 70 ? 'high' : risk >= 45 ? 'moderate' : risk >= 25 ? 'elevated' : 'low'

  const levelLabel =
    lang === 'hi'
      ? { high: 'उच्च', moderate: 'मध्यम', elevated: 'थोड़ा बढ़ा', low: 'कम' }[level]
      : { high: 'High', moderate: 'Moderate', elevated: 'Elevated', low: 'Low' }[level]

  // Hourly road scores → safer windows
  const scored = hours.slice(0, 18).map((h) => {
    let s = 10
    if (h.pop >= 70) s += 30
    else if (h.pop >= 45) s += 15
    if (h.rain > 1) s += 25
    else if (h.rain > 0.2) s += 10
    if (h.code >= 95) s += 35
    else if (h.code >= 61) s += 12
    // night penalty mild
    const hr = new Date(h.time).getHours()
    if (hr >= 22 || hr < 5) s += 8
    return { ...h, roadScore: clamp(s, 0, 100) }
  })

  // find contiguous low-risk windows (score < 35)
  const windows = []
  let buf = []
  for (const h of scored) {
    if (h.roadScore < 35) {
      buf.push(h)
    } else {
      if (buf.length >= 2) windows.push([...buf])
      buf = []
    }
  }
  if (buf.length >= 2) windows.push(buf)
  windows.sort((a, b) => {
    const sa = a.reduce((x, y) => x + y.roadScore, 0) / a.length
    const sb = b.reduce((x, y) => x + y.roadScore, 0) / b.length
    return sa - sb || b.length - a.length
  })

  const best = windows[0]
  const saferWindow = best
    ? {
        start: best[0].label,
        end: best[best.length - 1].label,
        hours: best.length,
        avgRisk: Math.round(best.reduce((x, y) => x + y.roadScore, 0) / best.length),
      }
    : null

  const warnings = []
  if (vis < 3) {
    warnings.push(
      lang === 'hi'
        ? `दृश्यता कम (~${vis.toFixed(1)} किमी) — कोहरा/बारिश; लो बीम, स्पीड कम`
        : `Low visibility (~${vis.toFixed(1)} km) — fog/rain; use low beam, reduce speed`
    )
  }
  if (wind >= 30) {
    warnings.push(
      lang === 'hi'
        ? `तेज़ हवा ~${wind} किमी/घं — दोपहिया/ऊँचे वाहन सावधानी`
        : `Strong wind ~${wind} km/h — caution for two-wheelers / high-profile vehicles`
    )
  }
  if (pop0 >= 60 || rain0 > 8) {
    warnings.push(
      lang === 'hi'
        ? `बारिश जोखिम आज ${pop0}% / ~${rain0} मिमी — जलभराव, अंडरपास बचें`
        : `Rain risk today ${pop0}% / ~${rain0} mm — waterlogging & underpass caution`
    )
  }
  if (code >= 95) {
    warnings.push(
      lang === 'hi'
        ? `आंधी-तूफान संकेत — गैर-ज़रूरी यात्रा टालें`
        : `Thunderstorm signal — defer non-essential travel`
    )
  }
  if (!warnings.length) {
    warnings.push(
      lang === 'hi' ? 'बड़े यात्रा अवरोध संकेत नहीं' : 'No major travel blockers flagged'
    )
  }

  const advice =
    lang === 'hi'
      ? level === 'high'
        ? 'अभी लंबी सड़क यात्रा टालें। अगर ज़रूरी हो तो दिन की सुरक्षित खिड़की चुनें, आपातकालीन किट रखें।'
        : level === 'moderate'
          ? 'यात्रा संभव लेकिन बफर टाइम रखें। हाईवे पर अचानक बौछारों के लिए तैयार रहें।'
          : 'सामान्य यात्रा ठीक। फिर भी मानसून/सर्दियों में हमेशा लो-लाइट सावधानी।'
      : level === 'high'
        ? 'Avoid long road trips right now. If essential, pick the safer daytime window and carry an emergency kit.'
        : level === 'moderate'
          ? 'Travel is doable with buffer time. Expect sudden showers on highways.'
          : 'Normal travel looks fine. Still use low-light caution in monsoon/winter.'

  return {
    visibilityKm: +vis.toFixed(1),
    windKmh: wind,
    riskScore: risk,
    riskLevel: level,
    riskLabel: levelLabel,
    warnings,
    saferWindow,
    hourlyRisk: scored.slice(0, 12),
    advice,
    rainToday: { pop: pop0, mm: rain0 },
  }
}

/**
 * SCHOOL MODE — extreme weather, outdoor activity, heat risk
 */
export function buildSchoolInsight(wx, lang = 'en') {
  const t = wx.current.temp
  const feels = wx.current.feelsLike
  const hum = wx.current.humidity
  const uv = wx.daily[0]?.uv ?? 6
  const pop = wx.daily[0]?.pop || 0
  const rain = wx.daily[0]?.rain || 0
  const wind = wx.current.wind || 0
  const code = wx.current.code
  const maxT = wx.daily[0]?.max || t

  // Heat index-ish
  const heatStress = feels >= 45 || maxT >= 42 ? 'extreme' : feels >= 38 || maxT >= 37 ? 'high' : feels >= 33 || maxT >= 34 ? 'moderate' : 'low'

  const heatLabel =
    lang === 'hi'
      ? { extreme: 'चरम', high: 'उच्च', moderate: 'मध्यम', low: 'कम' }[heatStress]
      : { extreme: 'Extreme', high: 'High', moderate: 'Moderate', low: 'Low' }[heatStress]

  // Outdoor activity score 0-100 (higher = better to go outside)
  let outdoor = 80
  if (heatStress === 'extreme') outdoor -= 55
  else if (heatStress === 'high') outdoor -= 35
  else if (heatStress === 'moderate') outdoor -= 15
  if (pop >= 70 || rain > 15) outdoor -= 40
  else if (pop >= 45) outdoor -= 20
  if (code >= 95) outdoor -= 50
  else if (code >= 65) outdoor -= 25
  if (wind >= 40) outdoor -= 20
  if (uv >= 9) outdoor -= 15
  else if (uv >= 7) outdoor -= 8
  outdoor = clamp(outdoor, 5, 95)

  const outdoorLevel =
    outdoor >= 70 ? 'good' : outdoor >= 45 ? 'caution' : outdoor >= 25 ? 'poor' : 'avoid'

  const outdoorLabel =
    lang === 'hi'
      ? { good: 'अनुकूल', caution: 'सावधानी', poor: 'अनुकूल नहीं', avoid: 'बचें' }[outdoorLevel]
      : { good: 'Favourable', caution: 'Caution', poor: 'Unfavourable', avoid: 'Avoid' }[outdoorLevel]

  const extreme = []
  if (code >= 95 || rain > 50 || pop >= 85) {
    extreme.push(
      lang === 'hi'
        ? 'गंभीर मौसम / भारी वर्षा — असेंबली/खेल मैदान रद्द करने पर विचार'
        : 'Severe weather / heavy rain — consider cancelling assembly & field sports'
    )
  }
  if (heatStress === 'extreme' || heatStress === 'high') {
    extreme.push(
      lang === 'hi'
        ? `हीट रिस्क **${heatLabel}** (महसूस ~${feels}°C) — दोपहर 12–3 बजे बाहर न निकालें`
        : `Heat risk **${heatLabel}** (feels ~${feels}°C) — keep students indoors 12–3 pm`
    )
  }
  if (wx.alerts?.some((a) => a.severity === 'red' || a.severity === 'amber')) {
    const a = wx.alerts[0]
    extreme.push(
      lang === 'hi'
        ? `सक्रिय अलर्ट: ${a.severity.toUpperCase()} — ${a.title_hi || a.title}`
        : `Active alert: ${a.severity.toUpperCase()} — ${a.title}`
    )
  }
  if (!extreme.length) {
    extreme.push(
      lang === 'hi' ? 'कोई चरम स्कूल-स्तरीय चेतावनी नहीं' : 'No extreme school-level warnings active'
    )
  }

  // Best outdoor slot from hourly (morning preferred)
  const hours = (wx.hourly || []).slice(0, 12)
  const ranked = hours
    .map((h) => {
      const hr = new Date(h.time).getHours()
      let score = 50
      if (hr >= 7 && hr <= 10) score += 25
      if (hr >= 16 && hr <= 18) score += 10
      if (hr >= 12 && hr <= 15) score -= 20
      score -= h.pop * 0.4
      score -= h.temp > 36 ? 25 : h.temp > 33 ? 12 : 0
      if (h.code >= 61) score -= 20
      return { ...h, score }
    })
    .sort((a, b) => b.score - a.score)

  const bestSlot = ranked[0]

  const recommendations =
    lang === 'hi'
      ? [
          outdoorLevel === 'avoid' || outdoorLevel === 'poor'
            ? 'PT / खुले मैदान के खेल इंडोर शिफ्ट करें'
            : 'हल्की PT सुबह की खिड़की में रखें',
          heatStress === 'high' || heatStress === 'extreme'
            ? 'अतिरिक्त पानी ब्रेक + छायादार कतार'
            : 'सामान्य जल व्यवस्था पर्याप्त',
          pop >= 50 ? 'छाते / रेनवेयर डिस्मिसल पर' : 'सामान्य डिस्मिसल',
          uv >= 7 ? 'टोपी + सनस्क्रीन आउटडोर कक्षाओं के लिए' : 'UV सामान्य',
        ]
      : [
          outdoorLevel === 'avoid' || outdoorLevel === 'poor'
            ? 'Shift PE / open-field sports indoors'
            : 'Light PE OK in the morning window',
          heatStress === 'high' || heatStress === 'extreme'
            ? 'Extra water breaks + shaded queues'
            : 'Normal hydration routine is enough',
          pop >= 50 ? 'Umbrellas / rainwear at dismissal' : 'Normal dismissal',
          uv >= 7 ? 'Caps + sunscreen for outdoor classes' : 'UV looks manageable',
        ]

  return {
    heatStress,
    heatLabel,
    heatFeels: feels,
    maxTemp: maxT,
    uv: uv != null ? +Number(uv).toFixed(1) : null,
    outdoorScore: outdoor,
    outdoorLevel,
    outdoorLabel,
    extreme,
    recommendations,
    bestOutdoor:
      bestSlot && bestSlot.score > 30
        ? { time: bestSlot.label, temp: bestSlot.temp, pop: bestSlot.pop }
        : null,
    humidity: hum,
    wind,
  }
}

/** Format prediction as rich chat summary */
export function predictionSummaryText(wx, lang) {
  const p = buildPrediction(wx, lang)
  const city = lang === 'hi' ? wx.city.name_hi || wx.city.name : wx.city.name
  if (lang === 'hi') {
    return (
      `## 🔮 मौसम भविष्यवाणी — ${city}\n\n` +
      `### सारांश\n${p.headline}\n\n` +
      `### क्या उम्मीद करें\n${p.bullets.map((b) => `• ${b}`).join('\n')}\n\n` +
      `${p.takeaway}\n\n` +
      `### मॉडल विश्वास\n**${Math.round(p.confidence * 100)}%** — Open-Meteo मल्टी-मॉडल + स्थानीय प्रवृत्तियाँ।\n\n` +
      `### अगला कदम\n• विस्तृत ग्राफ: **Forecast** टैब\n• सड़क: **Travel** मोड\n• स्कूल: **School** मोड`
    )
  }
  return (
    `## 🔮 Weather prediction — ${city}\n\n` +
    `### Executive summary\n${p.headline}\n\n` +
    `### What to expect\n${p.bullets.map((b) => `• ${b}`).join('\n')}\n\n` +
    `${p.takeaway}\n\n` +
    `### Model confidence\n**${Math.round(p.confidence * 100)}%** — Open-Meteo multi-model blend + local trend heuristics.\n\n` +
    `### Next steps\n• Charts: **Forecast** tab\n• Road risk: **Travel** mode\n• Campus: **School** mode`
  )
}
