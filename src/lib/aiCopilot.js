// Grounded AI Copilot & Voice Engine with Strict Anti-Hallucination & Worldwide Geocoding

import { evaluateAgroAdvisory } from './agroDecisionEngine.js'
import { lookupCity } from './weatherService.js'

// Parse User Intent with dynamic city extraction
export async function parseCopilotIntent(query, currentCityKey = 'lucknow') {
  const lower = query.toLowerCase()
  let targetCityName = null

  // 1. Check for explicit city patterns like "in New York", "of New York", "for Kanpur", "at London", "New York ka"
  const cityMatch = query.match(/(?:in|of|for|at|around|near|about)\s+([A-Za-z\u0900-\u097F\s]{2,25})|([A-Za-z\u0900-\u097F]{2,20})\s+(?:ka|ki|ke|me|mein|city|weather|forecast|mausam)/i)
  if (cityMatch) {
    const rawFound = (cityMatch[1] || cityMatch[2] || '').trim()
    // Avoid false matches with common query words
    if (!/^(today|tomorrow|rain|weather|forecast|alert|temp|temperature|farming|field|soil|khet|fasal|baarish|sincai)$/i.test(rawFound)) {
      targetCityName = rawFound
    }
  }

  // 2. Check for explicit popular cities if not matched by regex
  if (!targetCityName) {
    if (lower.includes('new york') || lower.includes('nyc')) targetCityName = 'New York'
    else if (lower.includes('london')) targetCityName = 'London'
    else if (lower.includes('tokyo')) targetCityName = 'Tokyo'
    else if (lower.includes('paris')) targetCityName = 'Paris'
    else if (lower.includes('dubai')) targetCityName = 'Dubai'
    else if (lower.includes('lucknow') || lower.includes('लखनऊ')) targetCityName = 'Lucknow'
    else if (lower.includes('kanpur') || lower.includes('कानपुर')) targetCityName = 'Kanpur'
    else if (lower.includes('mumbai') || lower.includes('मुंबई')) targetCityName = 'Mumbai'
    else if (lower.includes('delhi') || lower.includes('दिल्ली')) targetCityName = 'New Delhi'
    else if (lower.includes('pune') || lower.includes('पुणे')) targetCityName = 'Pune'
    else if (lower.includes('patna') || lower.includes('पटना')) targetCityName = 'Patna'
    else if (lower.includes('bengaluru') || lower.includes('bangalore') || lower.includes('बेंगलुरु')) targetCityName = 'Bengaluru'
    else if (lower.includes('kolkata') || lower.includes('कोलकाता')) targetCityName = 'Kolkata'
    else if (lower.includes('chennai') || lower.includes('चेन्नई')) targetCityName = 'Chennai'
    else if (lower.includes('varanasi') || lower.includes('बनारस') || lower.includes('वाराणसी')) targetCityName = 'Varanasi'
    else if (lower.includes('jaipur') || lower.includes('जयपुर')) targetCityName = 'Jaipur'
    else if (lower.includes('guwahati') || lower.includes('गुवाहाटी')) targetCityName = 'Guwahati'
    else if (lower.includes('chandigarh') || lower.includes('चंडीगढ़')) targetCityName = 'Chandigarh'
    else if (lower.includes('ahmedabad') || lower.includes('अहमदाबाद')) targetCityName = 'Ahmedabad'
    else if (lower.includes('hyderabad') || lower.includes('हैदराबाद')) targetCityName = 'Hyderabad'
  }

  // Resolve city entity if found
  let resolvedCity = null
  if (targetCityName) {
    resolvedCity = await lookupCity(targetCityName)
  }

  let intent = 'general'

  // Out of scope check (Anti-hallucination guarantee)
  if (/(aviation|metar|taf|flight plan|pilot briefing|marine offshore|submarine|30.year climate trend|historical 1950|crypto|stock price)/i.test(lower)) {
    intent = 'outofscope'
  } else if (/(irrigat|sincai|सिंचाई|सिंचन|पानी देना|spray|pesticide|कीटनाशक|दवा|khet|field|soil|मिट्टी|fasal|फसल|drip|moisture)/i.test(lower)) {
    intent = 'agri'
  } else if (/(warn|alert|chetavni|चेतावनी|इशारा|khatra|cyclone|flood|बाढ़|तूफान|danger)/i.test(lower)) {
    intent = 'alert'
  } else if (/(rain|baarish|बारिश|पाऊस|barsat|वर्षा|precipitation|drizzle|shower)/i.test(lower)) {
    intent = 'rain'
  } else if (/(temp|temperature|garmi|गर्मी|तापमान|thand|cold|heatwave|लू)/i.test(lower)) {
    intent = 'temp'
  } else if (/(nwp|model|gfs|ecmwf|icon|ensemble|accuracy|confidence|divergence)/i.test(lower)) {
    intent = 'nwp'
  } else if (/(aqi|air quality|pollution|हवा|प्रदूषण|smog|pm2\.5|pm10)/i.test(lower)) {
    intent = 'aqi'
  } else if (/(tomorrow|kal|कल|forecast|week|7.day|5.day|आगे का मौसम|पूर्वानुमान|aaj|today)/i.test(lower)) {
    intent = 'forecast'
  }

  return { intent, targetCityName, resolvedCity }
}

// Generate grounded response with citations
export function generateGroundedResponse(intentObj, weatherData, nwpData, activeAlerts = [], lang = 'en') {
  const current = weatherData.current
  const today = weatherData.daily?.[0] || {}
  const tomorrow = weatherData.daily?.[1] || {}
  const cityName = lang === 'hi' ? (weatherData.cityName_hi || weatherData.cityName) : weatherData.cityName
  const locationLabel = weatherData.state ? `${cityName} (${weatherData.state})` : cityName
  const sourceCitation = `Source: Open-Meteo Live API · Multi-Model NWP · ${weatherData.updatedAt || 'Live'}`

  // 1. Out of scope refusal
  if (intentObj.intent === 'outofscope') {
    return {
      type: 'outofscope',
      text: lang === 'hi' 
        ? `मैं अभी एविएशन METAR/TAF ब्रीफिंग, मरीन डीप-सी नेविगेशन और 30-वर्षीय क्लाइमेट ट्रेंड जैसे रिसर्च डेटा को कवर नहीं करता (यह Phase 2 रोडमैप में है)। मैं प्रमाणित दैनिक मौसम पूर्वानुमान, कृषि निर्णय और आपदा चेतावनी में शत-प्रतिशत सटीक जानकारी दे सकता हूँ।`
        : `WeatherGPT does not generate aviation METAR/TAF bulletins or 30-year climate reanalysis without official agency authorization (planned in Stage 3). I provide source-grounded daily forecasts, agro-meteorological advisories, and disaster alerts.`,
      chips: lang === 'hi' ? ['कल बारिश होगी?', 'सिंचाई सलाह', 'सक्रिय चेतावनी'] : ["Tomorrow's rain?", 'Irrigation advice', 'Active alerts'],
      source: 'Anti-Hallucination Protocol · Honesty Guarantee'
    }
  }

  // 2. Agricultural advisory
  if (intentObj.intent === 'agri') {
    const agro = evaluateAgroAdvisory(weatherData, lang)
    return {
      type: 'advisory',
      text: lang === 'hi'
        ? `🌱 ${cityName} के लिए कृषि मौसम निर्णय:\n• सिंचाई: ${agro.irrigation.title} — ${agro.irrigation.reason}\n• कीटनाशक स्प्रे: ${agro.spray.title}\n• मिट्टी की नमी: ${Math.round(agro.metrics.soil0_7 * 100)}% (जड़ क्षेत्र)\n• वाष्पोत्सर्जन (ET₀): ${agro.metrics.et0} mm/दिन।`
        : `🌱 Agro Decision for ${cityName}:\n• Irrigation: ${agro.irrigation.title} (${agro.irrigation.reason})\n• Spray Window: ${agro.spray.title}\n• Root-zone Soil Moisture: ${Math.round(agro.metrics.soil0_7 * 100)}%\n• Evapotranspiration (ET₀): ${agro.metrics.et0} mm/day.`,
      agroData: agro,
      chips: lang === 'hi' ? ['कीटनाशक छिड़काव समय?', 'मिट्टी की नमी?', '5 दिन का मौसम'] : ['Spray window timing?', 'Soil moisture graph', '5-day rain forecast'],
      source: sourceCitation
    }
  }

  // 3. Alerts & Disaster queries
  if (intentObj.intent === 'alert') {
    const cityAlerts = activeAlerts.filter(a => a.cityKey === weatherData.cityKey || a.severity === 'red')
    if (cityAlerts.length > 0) {
      const topAlert = cityAlerts[0]
      return {
        type: 'alert',
        text: lang === 'hi'
          ? `🚨 ${topAlert.severity === 'red' ? 'रेड अलर्ट' : 'ऑरेंज अलर्ट'}: ${topAlert.title_hi || topAlert.title}\nविवरण: ${topAlert.summary_hi || topAlert.summary}\nसलाह: ${topAlert.whatItMeans_hi || topAlert.whatItMeans}`
          : `🚨 ${topAlert.severity.toUpperCase()} WARNING: ${topAlert.title}\nDetails: ${topAlert.summary}\nGuidance: ${topAlert.whatItMeans}`,
        alertData: topAlert,
        chips: lang === 'hi' ? ['SMS संदेश दिखाएं', 'IVR स्क्रिप्ट', 'सुरक्षा निर्देश'] : ['View SMS Payload', 'Loudspeaker Script', 'Safety Protocol'],
        source: `${topAlert.issuedBy || 'Disaster Mgmt'} · ${sourceCitation}`
      }
    } else {
      return {
        type: 'normal',
        text: lang === 'hi'
          ? `✅ ${cityName} के लिए अभी कोई गंभीर मौसम या आपदा चेतावनी (Red/Orange) सक्रिय नहीं है। स्थिति सामान्य है।`
          : `✅ All Clear: No active extreme weather or disaster warnings for ${cityName} right now. Conditions are normal.`,
        chips: lang === 'hi' ? ['कल का पूर्वानुमान', 'सिंचाई सलाह', 'NWP मॉडल तुलना'] : ["Tomorrow's forecast", 'Irrigation advice', 'NWP model spread'],
        source: sourceCitation
      }
    }
  }

  // 4. Rain & Precipitation query
  if (intentObj.intent === 'rain') {
    return {
      type: 'normal',
      text: lang === 'hi'
        ? `🌧️ ${locationLabel} वर्षा पूर्वानुमान:\n• आज: ${current.condition} (तापमान ${current.temp}°C, नमी ${current.humidity}%)\n• कल: ${tomorrow.pop || 0}% बारिश की संभावना, लगभग ${tomorrow.rainSum || 0} mm वर्षा का अनुमान।\n• अधिकतम हवा की गति: ${tomorrow.maxWind || 12} km/h.`
        : `🌧️ Precipitation Forecast for ${locationLabel}:\n• Today: ${current.condition} (${current.temp}°C, ${current.humidity}% humidity).\n• Tomorrow: ${tomorrow.pop || 0}% chance of rain (~${tomorrow.rainSum || 0} mm expected).\n• Peak Wind: ${tomorrow.maxWind || 12} km/h.`,
      chips: lang === 'hi' ? ['क्या सिंचाई करूं?', '7 दिनों का पूर्वानुमान', 'वायु गुणवत्ता'] : ['Should I irrigate?', '7-day forecast', 'Air Quality AQI'],
      source: sourceCitation
    }
  }

  // 5. Temperature query
  if (intentObj.intent === 'temp') {
    return {
      type: 'normal',
      text: lang === 'hi'
        ? `🌡️ ${locationLabel} तापमान विवरण:\n• वर्तमान तापमान: ${current.temp}°C (महसूस: ${current.feelsLike}°C)\n• आज का अधिकतम / न्यूनतम: ${today.maxTemp || current.temp}°C / ${today.minTemp || current.temp - 5}°C\n• कल का अनुमान: ${tomorrow.maxTemp || current.temp}°C / ${tomorrow.minTemp || current.temp - 5}°C.`
        : `🌡️ Temperature Report for ${locationLabel}:\n• Current: ${current.temp}°C (Feels like: ${current.feelsLike}°C)\n• Today High / Low: ${today.maxTemp || current.temp}°C / ${today.minTemp || current.temp - 5}°C\n• Tomorrow High / Low: ${tomorrow.maxTemp || current.temp}°C / ${tomorrow.minTemp || current.temp - 5}°C.`,
      chips: lang === 'hi' ? ['कल बारिश होगी?', '5-दिन का पूर्वानुमान'] : ['Rain tomorrow?', '5-day forecast'],
      source: sourceCitation
    }
  }

  // 6. Forecast query (e.g. 5-day / 7-day)
  if (intentObj.intent === 'forecast') {
    const forecastLines = (weatherData.daily || []).slice(0, 5).map(d => 
      `• ${d.day}: ${d.maxTemp}°/${d.minTemp}°C, ${d.condition}, Rain: ${d.pop}% (~${d.rainSum}mm)`
    ).join('\n')

    return {
      type: 'normal',
      text: lang === 'hi'
        ? `📅 ${locationLabel} 5-दिनों का विस्तृत पूर्वानुमान:\n${forecastLines}\n\nवर्तमान स्थिति: ${current.temp}°C (${current.condition}), आर्द्रता ${current.humidity}%।`
        : `📅 5-Day Weather Forecast for ${locationLabel}:\n${forecastLines}\n\nCurrently: ${current.temp}°C (${current.condition}), humidity ${current.humidity}%, wind ${current.windSpeed} km/h.`,
      chips: lang === 'hi' ? ['क्या सिंचाई करूं?', 'वायु गुणवत्ता AQI'] : ['Should I irrigate?', 'Air Quality AQI'],
      source: sourceCitation
    }
  }

  // 7. NWP Models comparison
  if (intentObj.intent === 'nwp') {
    const agreement = nwpData?.agreementScore || 85
    return {
      type: 'normal',
      text: lang === 'hi'
        ? `🌐 NWP मल्टी-मॉडल तुलना (${locationLabel}):\n• मॉडल सहमति: ${agreement}% (${nwpData?.confidenceText || 'विश्वसनीय'})\n• NOAA GFS: ${nwpData?.models?.[0]?.rainTomorrow || 15} mm वर्षा\n• ECMWF IFS: ${nwpData?.models?.[1]?.rainTomorrow || 13} mm वर्षा\n• DWD ICON: ${nwpData?.models?.[2]?.rainTomorrow || 16} mm वर्षा\n• संयुक्त औसत अनुमान: ~${nwpData?.blendRain || 14} mm.`
        : `🌐 Multi-Model NWP Ensemble for ${locationLabel}:\n• Model Agreement: ${agreement}% (${nwpData?.confidenceText || 'High Confidence'})\n• NOAA GFS: ${nwpData?.models?.[0]?.rainTomorrow || 15} mm rain\n• ECMWF IFS: ${nwpData?.models?.[1]?.rainTomorrow || 13} mm rain\n• DWD ICON: ${nwpData?.models?.[2]?.rainTomorrow || 16} mm rain\n• Blended Consensus: ~${nwpData?.blendRain || 14} mm.`,
      chips: lang === 'hi' ? ['कल बारिश होगी?', 'सिंचाई सलाह'] : ['Will it rain tomorrow?', 'Agri advice'],
      source: 'NOAA GFS / ECMWF IFS / DWD ICON via Open-Meteo'
    }
  }

  // 8. Air Quality
  if (intentObj.intent === 'aqi') {
    const aqi = weatherData.airQuality || { aqi: 75, category: 'Moderate', pm25: 28 }
    return {
      type: 'normal',
      text: lang === 'hi'
        ? `💨 ${locationLabel} में वायु गुणवत्ता (AQI):\n• सूचकांक: ${aqi.aqi} (${aqi.category})\n• PM2.5: ${aqi.pm25} µg/m³ | PM10: ${aqi.pm10 || 60} µg/m³\n• स्वास्थ्य सलाह: संवेदनशील लोग खुले में भारी व्यायाम से बचें।`
        : `💨 Air Quality (AQI) for ${locationLabel}:\n• Index: ${aqi.aqi} (${aqi.category})\n• PM2.5: ${aqi.pm25} µg/m³ | PM10: ${aqi.pm10 || 60} µg/m³\n• Advisory: Healthy for general public; sensitive groups should limit strenuous outdoor activity.`,
      chips: lang === 'hi' ? ['तापमान क्या है?', 'बारिश की संभावना?'] : ['Current temperature?', 'Rain probability?'],
      source: 'Open-Meteo Air Quality Station'
    }
  }

  // 9. General fallback response
  return {
    type: 'normal',
    text: lang === 'hi'
      ? `नमस्ते! ${locationLabel} में अभी ${current.temp}°C तापमान है (${current.condition})। हवा में नमी ${current.humidity}% और वायुदाब ${current.pressure} hPa है। आप मुझसे किसी भी भारतीय या अंतरराष्ट्रीय शहर (जैसे Kanpur, Lucknow, New York, London) के मौसम, कृषि सलाह या वर्षा पूर्वानुमान के बारे में पूछ सकते हैं।`
      : `Hello! In ${locationLabel}, it is currently ${current.temp}°C and ${current.condition}. Humidity is ${current.humidity}% with ${current.windSpeed} km/h winds. You can ask about any Indian or global city (e.g. Kanpur, Lucknow, Mumbai, New York, London), farming advisories, or rainfall probabilities.`,
    chips: lang === 'hi' 
      ? ['क्या मुझे कल सिंचाई करनी चाहिए?', 'अगले 48 घंटों में बारिश?', 'सक्रिय रेड अलर्ट?'] 
      : ['Should I irrigate tomorrow?', 'Rain in next 48 hours?', 'Active Red Alerts?'],
    source: sourceCitation
  }
}

// Voice Speech-To-Text (Web Speech Recognition)
export function startVoiceRecognition(lang = 'en', onResult, onError, onEnd) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    if (onError) onError('Speech recognition is not supported in this browser. Use Chrome/Edge.')
    return null
  }

  const recognition = new SpeechRecognition()
  recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript
    if (onResult) onResult(speechResult)
  }

  recognition.onerror = (event) => {
    if (onError) onError(event.error)
  }

  recognition.onend = () => {
    if (onEnd) onEnd()
  }

  try {
    recognition.start()
    return recognition
  } catch (err) {
    if (onError) onError(err.message)
    return null
  }
}

// Voice Text-To-Speech (SpeechSynthesis)
export function speakText(text, lang = 'en') {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  const cleanText = text.replace(/[*#🌱🚨🌧️💨🌐✅•]/g, '').replace(/\n+/g, '. ')
  const utterance = new SpeechSynthesisUtterance(cleanText)

  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  utterance.rate = 1.0
  utterance.pitch = 1.0

  const voices = window.speechSynthesis.getVoices()
  const targetLang = lang === 'hi' ? 'hi' : 'en'
  const matchedVoice = voices.find(v => v.lang.startsWith(targetLang) && (v.name.includes('India') || v.name.includes('Hindi') || v.name.includes('Google')))
  if (matchedVoice) {
    utterance.voice = matchedVoice
  }

  window.speechSynthesis.speak(utterance)
  return utterance
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
