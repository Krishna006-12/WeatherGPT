/**
 * Shareable daily briefing + structured AI brief for UI
 * Grounded on live weather pack + insights (no fabricated data)
 */

import { buildPrediction, buildTravelInsight, buildSchoolInsight, estimateVisibility } from './insights'

/**
 * Structured AI brief for the product home — What / Expect / Do
 */
export function buildStructuredBrief(wx, aqi, lang = 'en') {
  if (!wx) return null
  const pred = buildPrediction(wx, lang)
  const travel = buildTravelInsight(wx, lang)
  const school = buildSchoolInsight(wx, lang)
  const c = wx.current
  const d0 = wx.daily[0]
  const city = lang === 'hi' ? wx.city.name_hi || wx.city.name : wx.city.name
  const confPct = Math.round(pred.confidence * 100)

  const what =
    lang === 'hi'
      ? `अभी **${city}** में **${c.condition_hi}**, तापमान **${c.temp}°C** (महसूस ${c.feelsLike}°C), नमी **${c.humidity}%**, हवा **${c.wind} किमी/घं**.`
      : `Right now in **${city}**: **${c.condition}**, **${c.temp}°C** (feels ${c.feelsLike}°C), humidity **${c.humidity}%**, wind **${c.wind} km/h**.`

  const expectBits = []
  if (d0) {
    expectBits.push(
      lang === 'hi'
        ? `आज उच्च/न्यून **${d0.max}°/${d0.min}°C**, बारिश संभावना **${d0.pop}%** (~${d0.rain} मिमी).`
        : `Today high/low **${d0.max}°/${d0.min}°C**, rain chance **${d0.pop}%** (~${d0.rain} mm).`
    )
  }
  expectBits.push(pred.headline)
  if (pred.bestDryWindow) {
    expectBits.push(
      lang === 'hi'
        ? `साफ/बेहतर खिड़की: **${pred.bestDryWindow.start}–${pred.bestDryWindow.end}**.`
        : `Clearer window: **${pred.bestDryWindow.start}–${pred.bestDryWindow.end}**.`
    )
  }

  let recommendation
  if (wx.alerts?.[0] && (wx.alerts[0].severity === 'red' || wx.alerts[0].severity === 'amber')) {
    const a = wx.alerts[0]
    recommendation =
      lang === 'hi'
        ? `सक्रिय **${a.severity.toUpperCase()}** अलर्ट — ${a.title_hi || a.title}. आधिकारिक सलाह देखें और गैर-ज़रूरी बाहर निकलना सीमित करें।`
        : `Active **${a.severity.toUpperCase()}** alert — ${a.title}. Follow official guidance and limit non-essential outdoor exposure.`
  } else if (travel.riskLevel === 'high' || travel.riskLevel === 'moderate') {
    recommendation =
      lang === 'hi'
        ? `यात्रा जोखिम **${travel.riskLabel}**। ${travel.advice}`
        : `Travel risk **${travel.riskLabel}**. ${travel.advice}`
  } else if (school.outdoorLevel === 'avoid' || school.outdoorLevel === 'poor') {
    recommendation =
      lang === 'hi'
        ? `आउटडोर/स्कूल गतिविधि **${school.outdoorLabel}**. ${school.recommendations[0]}`
        : `Outdoor/school activity **${school.outdoorLabel}**. ${school.recommendations[0]}`
  } else if ((d0?.pop || 0) >= 55) {
    recommendation =
      lang === 'hi'
        ? `बारिश सुरक्षा रखें; शाम की योजना में बफर रखें। सिंचाई/छिड़काव Farm मोड से मिलाएँ।`
        : `Keep rain protection handy; buffer evening plans. Cross-check irrigation/spray in Farm mode.`
  } else {
    recommendation =
      lang === 'hi'
        ? `सामान्य दिन की योजना ठीक। सुबह की खिड़कियाँ बाहरी काम के लिए बेहतर।`
        : `Normal-day planning is fine. Morning windows remain best for outdoor tasks.`
  }

  if (aqi?.aqi != null && aqi.aqi > 100) {
    recommendation +=
      lang === 'hi'
        ? ` AQI **${aqi.aqi}** (${aqi.band.hi}) — संवेदनशील समूह बाहर की मेहनत सीमित करें।`
        : ` AQI **${aqi.aqi}** (${aqi.band.en}) — sensitive groups should limit outdoor exertion.`
  }

  return {
    what,
    expect: expectBits.join(' '),
    recommendation,
    confidence: pred.confidence,
    confidencePct: confPct,
    confidenceLabel:
      confPct >= 85 ? (lang === 'hi' ? 'उच्च' : 'High') : confPct >= 75 ? (lang === 'hi' ? 'अच्छा' : 'Good') : lang === 'hi' ? 'मध्यम' : 'Moderate',
    headline: pred.headline,
    bullets: pred.bullets,
    takeaway: pred.takeaway,
    observed: {
      temp: c.temp,
      feelsLike: c.feelsLike,
      condition: lang === 'hi' ? c.condition_hi : c.condition,
      humidity: c.humidity,
      wind: c.wind,
    },
    forecast: {
      max: d0?.max,
      min: d0?.min,
      pop: d0?.pop,
      rain: d0?.rain,
    },
  }
}

export function buildDailyBriefing(wx, aqi, lang = 'en') {
  if (!wx) return ''
  const city = lang === 'hi' ? wx.city.name_hi || wx.city.name : wx.city.name
  const pred = buildPrediction(wx, lang)
  const travel = buildTravelInsight(wx, lang)
  const school = buildSchoolInsight(wx, lang)
  const vis = estimateVisibility(wx)
  const c = wx.current
  const d0 = wx.daily[0]
  const alert = wx.alerts?.[0]
  const brief = buildStructuredBrief(wx, aqi, lang)

  const aqiLine =
    aqi?.aqi != null
      ? lang === 'hi'
        ? `AQI ${aqi.aqi} (${aqi.band.hi}) · PM2.5 ${aqi.pm25 ?? '—'}`
        : `AQI ${aqi.aqi} (${aqi.band.en}) · PM2.5 ${aqi.pm25 ?? '—'}`
      : lang === 'hi'
        ? 'AQI: उपलब्ध नहीं'
        : 'AQI: n/a'

  if (lang === 'hi') {
    return (
      `☀️ WeatherGPT डेली ब्रीफिंग — ${city}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🌡️ अभी: ${c.temp}°C (महसूस ${c.feelsLike}°C) · ${c.condition_hi}\n` +
      `📊 आज: ${d0.min}–${d0.max}°C · बारिश ${d0.pop}% (~${d0.rain} मिमी)\n` +
      `👁️ दृश्यता ~${vis} किमी · 💨 हवा ${c.wind} किमी/घं\n` +
      `🏭 ${aqiLine}\n` +
      `⚠️ अलर्ट: ${alert ? `${alert.severity.toUpperCase()} — ${alert.title_hi || alert.title}` : 'कोई गंभीर नहीं'}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📋 क्या हो रहा: ${brief?.what || ''}\n` +
      `🔮 उम्मीद: ${pred.headline}\n` +
      `✅ सलाह: ${brief?.recommendation || ''}\n` +
      `🚗 यात्रा: ${travel.riskLabel} (${travel.riskScore}/100)\n` +
      `🏫 स्कूल: ${school.outdoorLabel} · हीट ${school.heatLabel}\n` +
      `🌾 सिंचाई: ${wx.agri.advice_hi}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔗 WeatherGPT · स्रोत: Open-Meteo` +
      (wx.live ? ' · LIVE' : ' · offline pack')
    )
  }

  return (
    `☀️ WeatherGPT Daily Briefing — ${city}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🌡️ Now: ${c.temp}°C (feels ${c.feelsLike}°C) · ${c.condition}\n` +
    `📊 Today: ${d0.min}–${d0.max}°C · rain ${d0.pop}% (~${d0.rain} mm)\n` +
    `👁️ Visibility ~${vis} km · 💨 Wind ${c.wind} km/h\n` +
    `🏭 ${aqiLine}\n` +
    `⚠️ Alert: ${alert ? `${alert.severity.toUpperCase()} — ${alert.title}` : 'None severe'}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📋 What's happening: ${brief?.what || ''}\n` +
    `🔮 Expect: ${pred.headline}\n` +
    `✅ Recommendation: ${brief?.recommendation || ''}\n` +
    `🚗 Travel: ${travel.riskLabel} (${travel.riskScore}/100)\n` +
    `🏫 School: ${school.outdoorLabel} · heat ${school.heatLabel}\n` +
    `🌾 Irrigation: ${wx.agri.advice_en}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🔗 WeatherGPT · Source: Open-Meteo` +
    (wx.live ? ' · LIVE' : ' · offline pack')
  )
}

export async function shareBriefing(text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'WeatherGPT Briefing', text })
      return 'shared'
    } catch {
      /* user cancel */
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
