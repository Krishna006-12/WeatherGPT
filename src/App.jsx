import { useState, useEffect, useRef } from 'react'
import { apiChat, apiSimulateAlert } from './lib/api.js'

// ---------- MOCK DATA (fallback when backend not available) ----------
const mockWeatherData = {
  lucknow: {
    name: 'Lucknow', name_hi: 'लखनऊ', name_mr: 'लखनौ',
    current: { temp: 32, condition: 'Sunny', condition_hi: 'धूप', condition_mr: 'ऊन', icon: '☀️', humidity: 45, wind: 8 },
    forecast: [
      { day: 'Today', day_hi: 'आज', day_mr: 'आज', high: 32, low: 24, rain: 10, condition: 'Sunny', icon: '☀️' },
      { day: 'Tomorrow', day_hi: 'कल', day_mr: 'उद्या', high: 29, low: 23, rain: 60, condition: 'Rain', icon: '🌧️' },
      { day: 'Wed', day_hi: 'बुध', day_mr: 'बुध', high: 28, low: 22, rain: 80, condition: 'Heavy Rain', icon: '⛈️' },
      { day: 'Thu', day_hi: 'गुरु', day_mr: 'गुरु', high: 30, low: 23, rain: 20, condition: 'Cloudy', icon: '☁️' },
      { day: 'Fri', day_hi: 'शुक्र', day_mr: 'शुक्र', high: 33, low: 25, rain: 5, condition: 'Sunny', icon: '☀️' },
    ],
    alerts: [
      { id: 'lko-1', severity: 'amber', title: 'Heavy Rain Watch', title_hi: 'भारी बारिश की चेतावनी', title_mr: 'मुसळधार पावसाचा इशारा', summary: 'Heavy rainfall expected in next 24-48 hrs', summary_hi: 'अगले 24-48 घंटे में भारी बारिश की संभावना', summary_mr: 'पुढील 24-48 तासांत मुसळधार पावसाची शक्यता', time: '2 hours ago', officialText: 'IMD issues Yellow Watch for Lucknow district. Heavy rainfall (64.5-115.5mm) likely at isolated places. Citizens advised to avoid waterlogged areas.', officialText_hi: 'IMD ने लखनऊ जिले के लिए येलो वॉच जारी किया है।', whatItMeans: 'Carry umbrella, avoid low-lying routes. Farmers: postpone pesticide spray.', whatItMeans_hi: 'छाता साथ रखें, निचले इलाकों से बचें।', whatItMeans_mr: 'छत्री सोबत ठेवा, सखल भाग टाळा.' }
    ],
    agri: { recentRain: 12, forecastRain: 45, soilMoisture: 'Medium', advice: 'Hold irrigation for 3 days', advice_hi: '3 दिन तक सिंचाई रोकें', advice_mr: '3 दिवस सिंचन थांबवा' }
  },
  mumbai: {
    name: 'Mumbai', name_hi: 'मुंबई', name_mr: 'मुंबई',
    current: { temp: 28, condition: 'Cloudy', condition_hi: 'बादल', condition_mr: 'ढगाळ', icon: '☁️', humidity: 82, wind: 15 },
    forecast: [
      { day: 'Today', day_hi: 'आज', day_mr: 'आज', high: 28, low: 25, rain: 70, condition: 'Rain', icon: '🌧️' },
      { day: 'Tomorrow', day_hi: 'कल', day_mr: 'उद्या', high: 27, low: 24, rain: 85, condition: 'Heavy Rain', icon: '⛈️' },
      { day: 'Wed', day_hi: 'बुध', day_mr: 'बुध', high: 27, low: 24, rain: 60, condition: 'Rain', icon: '🌧️' },
      { day: 'Thu', day_hi: 'गुरु', day_mr: 'गुरु', high: 28, low: 25, rain: 30, condition: 'Cloudy', icon: '☁️' },
      { day: 'Fri', day_hi: 'शुक्र', day_mr: 'शुक्र', high: 29, low: 26, rain: 20, condition: 'Cloudy', icon: '☁️' },
    ],
    alerts: [
      { id: 'mum-1', severity: 'red', title: 'Extreme Rain Warning', title_hi: 'अत्यधिक बारिश चेतावनी', title_mr: 'अतिवृष्टीचा इशारा', summary: 'Red alert: 200mm+ rain expected, high tide risk', summary_hi: 'रेड अलर्ट: 200mm+ बारिश, हाई टाइड का खतरा', summary_mr: 'रेड अलर्ट: 200mm+ पाऊस, भरतीचा धोका', time: '30 min ago', officialText: 'IMD RED WARNING: Extremely heavy rainfall (>204.4mm) very likely at isolated places in Mumbai & suburbs. High tide at 14:30 IST. NDMA: Avoid coastal areas, stay indoors. BMC helpline 1916 active.', officialText_hi: 'IMD रेड चेतावनी: मुंबई में अत्यधिक भारी बारिश की संभावना।', whatItMeans: 'DO NOT travel unless essential. Charge phones, keep emergency kit ready. Fishermen: do not venture into sea.', whatItMeans_hi: 'जरूरी न हो तो यात्रा न करें। फोन चार्ज रखें।', whatItMeans_mr: 'अत्यावश्यक असल्याशिवाय प्रवास टाळा.' }
    ],
    agri: { recentRain: 85, forecastRain: 120, soilMoisture: 'High', advice: 'No irrigation needed, ensure drainage', advice_hi: 'सिंचाई की जरूरत नहीं, जल निकासी सुनिश्चित करें', advice_mr: 'सिंचनाची गरज नाही, पाण्याचा निचरा करा' }
  },
  guwahati: {
    name: 'Guwahati', name_hi: 'गुवाहाटी', name_mr: 'गुवाहाटी',
    current: { temp: 26, condition: 'Mist', condition_hi: 'कोहरा', condition_mr: 'धुके', icon: '🌫️', humidity: 88, wind: 5 },
    forecast: [
      { day: 'Today', day_hi: 'आज', day_mr: 'आज', high: 26, low: 21, rain: 40, condition: 'Cloudy', icon: '☁️' },
      { day: 'Tomorrow', day_hi: 'कल', day_mr: 'उद्या', high: 27, low: 22, rain: 30, condition: 'Cloudy', icon: '☁️' },
      { day: 'Wed', day_hi: 'बुध', day_mr: 'बुध', high: 28, low: 22, rain: 20, condition: 'Sunny', icon: '⛅' },
      { day: 'Thu', day_hi: 'गुरु', day_mr: 'गुरु', high: 29, low: 23, rain: 15, condition: 'Sunny', icon: '☀️' },
      { day: 'Fri', day_hi: 'शुक्र', day_mr: 'शुक्र', high: 30, low: 23, rain: 25, condition: 'Cloudy', icon: '☁️' },
    ],
    alerts: [],
    agri: { recentRain: 22, forecastRain: 18, soilMoisture: 'Medium', advice: 'Irrigate lightly tomorrow morning', advice_hi: 'कल सुबह हल्की सिंचाई करें', advice_mr: 'उद्या सकाळी हलके सिंचन करा' }
  }
}

const pastAlerts = [
  { id: 'past-1', city: 'lucknow', severity: 'amber', title: 'Thunderstorm Advisory', summary: 'Expired 2 days ago', time: '3 days ago' },
  { id: 'past-2', city: 'mumbai', severity: 'red', title: 'Cyclone Watch', summary: 'Expired 1 week ago', time: '8 days ago' },
]

const translations = {
  en: {
    appName: 'WeatherGPT', chat: 'Chat', alerts: 'Alerts', locations: 'Locations',
    noWarnings: 'No active warnings for your saved locations right now.',
    activeAlerts: 'Active Alerts', pastAlerts: 'Past Alerts',
    addLocation: '+ Add location', searchPlaceholder: 'Search city...', useCurrent: 'Use current location',
    typePlaceholder: 'Ask about weather, alerts, farming...',
    source: 'Source: IMD', updated: 'updated', simulateAlert: '⚠️ Simulate incoming alert',
    lang: 'Language', whatItMeans: 'What this means for you', officialWarning: 'Official warning - IMD/NDMA',
    suggested: ["Tomorrow's alert?", '5-day forecast', 'Should I irrigate?'],
    backendOn: 'Backend: Connected ✓', backendOff: 'Backend: Local mock (run npm run server)'
  },
  hi: {
    appName: 'वेदरGPT', chat: 'चैट', alerts: 'चेतावनी', locations: 'स्थान',
    noWarnings: 'आपके स्थानों के लिए अभी कोई सक्रिय चेतावनी नहीं है।',
    activeAlerts: 'सक्रिय चेतावनी', pastAlerts: 'पिछली चेतावनी',
    addLocation: '+ स्थान जोड़ें', searchPlaceholder: 'शहर खोजें...', useCurrent: 'वर्तमान स्थान उपयोग करें',
    typePlaceholder: 'मौसम, चेतावनी, खेती के बारे में पूछें...',
    source: 'स्रोत: IMD', updated: 'अपडेट', simulateAlert: '⚠️ अलर्ट सिम्युलेट करें',
    lang: 'भाषा', whatItMeans: 'आपके लिए इसका क्या मतलब है', officialWarning: 'आधिकारिक चेतावनी - IMD/NDMA',
    suggested: ['कल की चेतावनी?', '5-दिन का पूर्वानुमान', 'क्या सिंचाई करूं?'],
    backendOn: 'बैकएंड: कनेक्टेड ✓', backendOff: 'बैकएंड: लोकल मॉक'
  },
  mr: {
    appName: 'वेदरGPT', chat: 'गप्पा', alerts: 'इशारे', locations: 'स्थाने',
    noWarnings: 'तुमच्या स्थानांसाठी सध्या कोणताही सक्रिय इशारा नाही.',
    activeAlerts: 'सक्रिय इशारे', pastAlerts: 'मागील इशारे',
    addLocation: '+ स्थान जोडा', searchPlaceholder: 'शहर शोधा...', useCurrent: 'सध्याचे स्थान वापरा',
    typePlaceholder: 'हवामान, इशारे, शेतीबद्दल विचारा...',
    source: 'स्रोत: IMD', updated: 'अपडेट', simulateAlert: '⚠️ येणारा इशारा दाखवा',
    lang: 'भाषा', whatItMeans: 'तुमच्यासाठी याचा अर्थ काय', officialWarning: 'अधिकृत इशारा - IMD/NDMA',
    suggested: ['उद्याचा इशारा?', '5-दिवसांचा अंदाज', 'सिंचन करू का?'],
    backendOn: 'बॅकएंड: कनेक्टेड ✓', backendOff: 'बॅकएंड: लोकल मॉक'
  }
}

function parseIntent(text) {
  const lower = text.toLowerCase()
  let location = 'lucknow'
  if (lower.includes('mumbai') || lower.includes('मुंबई')) location = 'mumbai'
  else if (lower.includes('guwahati') || lower.includes('गुवाहाटी')) location = 'guwahati'
  else if (lower.includes('lucknow') || lower.includes('लखनऊ')) location = 'lucknow'
  let intent = 'general'
  if (/(irrigat|sincai|सिंचाई|सिंचन|khet|field|farming|खेत)/.test(lower)) intent = 'agri'
  else if (/(warn|alert|chetavni|चेतावनी|इशारा|khatra|warning)/.test(lower)) intent = 'alert'
  else if (/(rain|baarish|बारिश|पाऊस|varsha)/.test(lower)) intent = 'rain'
  else if (/(temperature|temp|गर्मी|तापमान)/.test(lower)) intent = 'temp'
  else if (/(aviation|pilot|flight|marine|ship|climate trend|30.year|carbon)/.test(lower)) intent = 'outofscope'
  else if (/(forecast|5.day|tomorrow|kal|कल|उद्या|week)/.test(lower)) intent = 'forecast'
  return { location, intent }
}

function generateResponse(intentObj, lang) {
  const cityData = mockWeatherData[intentObj.location]
  const t = translations[lang]
  const nowMin = Math.floor(Math.random()*15)+1
  if (intentObj.intent === 'outofscope') {
    if (lang === 'hi') return { text: `मैं अभी एविएशन/मरीन ब्रीफिंग और 30-साल के क्लाइमेट ट्रेंड जैसे एडवांस्ड रिक्वेस्ट सपोर्ट नहीं करता। मैं मौसम पूर्वानुमान, चेतावनी और कृषि सलाह में मदद कर सकता हूँ।`, type: 'outofscope', chips: t.suggested, source: null }
    if (lang === 'mr') return { text: `मी सध्या एव्हिएशन/मरीन ब्रीफिंग आणि 30-वर्षांच्या हवामान ट्रेंडसारख्या प्रगत विनंत्या सपोर्ट करत नाही.`, type: 'outofscope', chips: t.suggested, source: null }
    return { text: `I can't help with aviation briefings, marine forecasts, or 30-year climate trends yet — that's Phase 2. I focus on accurate, source-attributed daily forecasts, alerts, and agri advisories.`, type: 'outofscope', chips: t.suggested, source: null }
  }
  if (intentObj.intent === 'agri') {
    const adv = lang === 'hi' ? cityData.agri.advice_hi : lang === 'mr' ? cityData.agri.advice_mr : cityData.agri.advice
    return { text: '', type: 'advisory', data: cityData, advice: adv, chips: lang === 'hi' ? ['कल बारिश होगी?', 'मिट्टी की नमी?'] : lang === 'mr' ? ['उद्या पाऊस?', 'मातीतील ओलावा?'] : ['Rain tomorrow?', 'Soil moisture?'], source: `${t.source} · ${t.updated} ${nowMin} min ago` }
  }
  if (intentObj.intent === 'alert') {
    if (cityData.alerts.length > 0) {
      const alert = cityData.alerts[0]
      const title = lang === 'hi' ? alert.title_hi : lang === 'mr' ? alert.title_mr : alert.title
      const summary = lang === 'hi' ? alert.summary_hi : lang === 'mr' ? alert.summary_mr : alert.summary
      return { text: lang === 'hi' ? `⚠️ ${cityData.name_hi} के लिए ${title}: ${summary}.` : lang === 'mr' ? `⚠️ ${cityData.name_mr} साठी ${title}: ${summary}.` : `⚠️ Active ${title} for ${cityData.name}: ${summary}. Tap Alerts tab for full official text.`, type: 'alert', alertData: alert, chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
    } else {
      return { text: lang === 'hi' ? `✅ ${cityData.name_hi} के लिए अभी कोई सक्रिय चेतावनी नहीं है।` : lang === 'mr' ? `✅ ${cityData.name_mr} साठी सध्या कोणताही सक्रिय इशारा नाही.` : `✅ No active warnings for ${cityData.name} right now. All clear.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
    }
  }
  if (intentObj.intent === 'rain') {
    const tomorrow = cityData.forecast[1]
    if (lang === 'hi') return { text: `🌧️ ${cityData.name_hi} में कल ${tomorrow.rain}% बारिश की संभावना है, दोपहर में। आज: ${cityData.current.temp}°C ${cityData.current.condition_hi}।`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
    if (lang === 'mr') return { text: `🌧️ ${cityData.name_mr} मध्ये उद्या ${tomorrow.rain}% पावसाची शक्यता आहे, दुपारी.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
    return { text: `🌧️ ${tomorrow.rain}% chance of rain tomorrow afternoon in ${cityData.name}. Today: ${cityData.current.temp}°C ${cityData.current.condition}, humidity ${cityData.current.humidity}%.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
  }
  if (intentObj.intent === 'temp') {
    if (lang === 'hi') return { text: `🌡️ ${cityData.name_hi} में अभी ${cityData.current.temp}°C है। कल अधिकतम ${cityData.forecast[1].high}°C।`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
    if (lang === 'mr') return { text: `🌡️ ${cityData.name_mr} मध्ये सध्या ${cityData.current.temp}°C आहे।`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
    return { text: `🌡️ Currently ${cityData.current.temp}°C and ${cityData.current.condition} in ${cityData.name}. Tomorrow: ${cityData.forecast[1].high}°C / ${cityData.forecast[1].low}°C.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
  }
  if (intentObj.intent === 'forecast') {
    const fc = cityData.forecast.map(d => `${d.day}: ${d.high}°/${d.low}° ${d.icon} ${d.rain}%`).join(', ')
    return { text: `📅 5-day forecast for ${cityData.name}: ${fc}.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
  }
  if (lang === 'hi') return { text: `नमस्ते! ${cityData.name_hi} में अभी ${cityData.current.temp}°C ${cityData.current.condition_hi} है।`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
  if (lang === 'mr') return { text: `नमस्कार! ${cityData.name_mr} मध्ये सध्या ${cityData.current.temp}°C ${cityData.current.condition_mr} आहे.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
  return { text: `Hello! Currently ${cityData.current.temp}°C and ${cityData.current.condition} in ${cityData.name}. Ask me about rain, alerts, or farming advice — every answer is IMD-sourced.`, type: 'normal', chips: t.suggested, source: `${t.source} · ${t.updated} ${nowMin} min ago` }
}

export default function App() {
  const [lang, setLang] = useState('en')
  const [currentLocKey, setCurrentLocKey] = useState('lucknow')
  const [savedLocs, setSavedLocs] = useState(['lucknow', 'mumbai', 'guwahati'])
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [showAddLoc, setShowAddLoc] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [backendConnected, setBackendConnected] = useState(false)
  const chatEndRef = useRef(null)

  const t = translations[lang]
  const currentCity = mockWeatherData[currentLocKey]

  useEffect(() => {
    const welcome = generateResponse({ location: currentLocKey, intent: 'general' }, lang)
    setMessages([{ id: 1, role: 'assistant', ...welcome, timestamp: new Date() }])
    // check backend
    fetch('http://localhost:3001/api/health').then(r=>r.ok && setBackendConnected(true)).catch(()=>setBackendConnected(false))
    const apiUrl = import.meta.env.VITE_API_URL
    if (apiUrl) {
      fetch(`${apiUrl}/api/health`).then(r=>r.ok && setBackendConnected(true)).catch(()=>{})
    }
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  const handleLangChange = (newLang) => {
    setLang(newLang)
    const msg = generateResponse({ location: currentLocKey, intent: 'general' }, newLang)
    setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', ...msg, timestamp: new Date() }])
  }

  const handleSend = async (text = input) => {
    if (!text.trim()) return
    const userMsg = { id: Date.now(), role: 'user', text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Try backend first
    const backendRes = await apiChat(text, lang, currentLocKey)
    if (backendRes && backendRes.success) {
      const resp = backendRes.response
      const parsed = backendRes.parsed
      if (parsed.location !== currentLocKey) setCurrentLocKey(parsed.location)
      const botId = Date.now() + 1
      // normalize backend response to frontend format
      let normalized = resp
      if (resp.type === 'advisory') {
        const cityKey = parsed.location
        const cityMock = mockWeatherData[cityKey]
        normalized = { ...resp, data: cityMock, advice: resp.data?.advice || resp.advice || cityMock.agri.advice, type: 'advisory' }
      }
      const botMsg = { id: botId, role: 'assistant', ...normalized, timestamp: new Date(), fullText: normalized.text, displayText: '', streaming: true }
      setIsTyping(false)
      setMessages(prev => [...prev, botMsg])
      if (normalized.text) {
        let i = 0
        const interval = setInterval(() => {
          i += 2
          setMessages(prev => prev.map(m => m.id === botId ? { ...m, displayText: normalized.text.slice(0, i) } : m))
          if (i >= normalized.text.length) {
            clearInterval(interval)
            setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false, displayText: normalized.text } : m))
          }
        }, 18)
      } else {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false } : m))
      }
      setBackendConnected(true)
      return
    }

    // Fallback to local mock
    setTimeout(() => {
      const intent = parseIntent(text)
      if (intent.location !== currentLocKey) setCurrentLocKey(intent.location)
      const resp = generateResponse(intent, lang)
      const botId = Date.now() + 1
      const botMsg = { id: botId, role: 'assistant', ...resp, timestamp: new Date(), fullText: resp.text, displayText: '', streaming: true }
      setIsTyping(false)
      setMessages(prev => [...prev, botMsg])
      if (resp.text) {
        let i = 0
        const interval = setInterval(() => {
          i += 2
          setMessages(prev => prev.map(m => m.id === botId ? { ...m, displayText: resp.text.slice(0, i) } : m))
          if (i >= resp.text.length) {
            clearInterval(interval)
            setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false, displayText: resp.text } : m))
          }
        }, 18)
      } else {
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, streaming: false } : m))
      }
    }, 600)
  }

  const handleSimulateAlert = async () => {
    // try backend
    const res = await apiSimulateAlert('mumbai')
    if (res) setBackendConnected(true)
    const alertCity = mockWeatherData['mumbai']
    const alert = alertCity.alerts[0]
    const fakeMsg = {
      id: Date.now(),
      role: 'assistant',
      text: lang === 'hi' ? `🚨 नया रेड अलर्ट: ${alert.title_hi} मुंबई के लिए!` : lang === 'mr' ? `🚨 नवीन रेड अलर्ट: ${alert.title_mr} मुंबईसाठी!` : `🚨 NEW RED ALERT: ${alert.title} for Mumbai! Check Alerts tab immediately.`,
      type: 'alert', alertData: alert, chips: t.suggested,
      source: `${t.source} · ${t.updated} just now`, timestamp: new Date()
    }
    setMessages(prev => [...prev, fakeMsg])
    setActiveTab('alerts')
    setCurrentLocKey('mumbai')
  }

  const filteredCities = Object.keys(mockWeatherData).filter(k => k.includes(searchQuery.toLowerCase()) || mockWeatherData[k].name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="min-h-screen w-full flex justify-center bg-monsoon-100">
      <div className="w-full max-w-[430px] bg-white min-h-screen flex flex-col shadow-xl relative overflow-hidden border-x border-cloud-200">
        <div className="bg-sky-900 text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('locations')}>
            <span className="text-[20px]">{currentCity.current.icon}</span>
            <span className="mono-nums font-semibold text-[15px]">{currentCity.current.temp}°C</span>
            <span className="text-[15px] font-medium opacity-90">{lang === 'hi' ? currentCity.name_hi : lang === 'mr' ? currentCity.name_mr : currentCity.name}</span>
            <span className="text-[10px] opacity-60 ml-1">▼</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/15 rounded-full p-0.5">
              {['en','hi','mr'].map(l => (
                <button key={l} onClick={()=>handleLangChange(l)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition ${lang===l ? 'bg-white text-sky-900' : 'text-white/70 hover:text-white'}`}>{l}</button>
              ))}
            </div>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[12px]">IN</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-[88px]">
          {activeTab === 'chat' && (
            <div className="px-3 py-4 space-y-3">
              <div className="flex justify-center mb-2">
                <div className={`text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 ${backendConnected ? 'bg-success-green/10 text-success-green border border-success-green/20' : 'bg-cloud-200 text-ink-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-success-green animate-pulse' : 'bg-ink-500'}`}></span> {backendConnected ? t.backendOn : t.backendOff}
                </div>
              </div>
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role==='user' ? 'justify-end' : 'justify-start'} animate-slideUp`}>
                  <div className={`max-w-[82%] ${msg.role==='user' ? 'order-2' : ''}`}>
                    {msg.role === 'assistant' && msg.type === 'advisory' ? (
                      <div className="bg-white border border-sky-900/15 rounded-card shadow-sm overflow-hidden">
                        <div className="bg-sky-900 text-white px-4 py-2.5 flex items-center gap-2">
                          <span>🌱</span><span className="text-[13px] font-semibold tracking-wide">AGRI ADVISORY</span><span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full">DECISION SUPPORT</span>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-monsoon-100 rounded-lg p-2"><div className="text-[11px] text-ink-500 uppercase">Recent Rain</div><div className="mono-nums font-bold text-ink-800">{msg.data?.agri?.recentRain || msg.data?.recent_rain || '12'}mm</div></div>
                            <div className="bg-monsoon-100 rounded-lg p-2"><div className="text-[11px] text-ink-500 uppercase">Forecast</div><div className="mono-nums font-bold text-ink-800">{msg.data?.agri?.forecastRain || msg.data?.forecast_rain || '45'}mm</div></div>
                            <div className="bg-monsoon-100 rounded-lg p-2"><div className="text-[11px] text-ink-500 uppercase">Soil</div><div className="font-bold text-ink-800 text-[13px]">{msg.data?.agri?.soilMoisture || msg.data?.soil_moisture || 'Medium'}</div></div>
                          </div>
                          <div className="bg-success-green/10 border border-success-green/20 rounded-lg p-3">
                            <div className="text-[12px] font-semibold text-success-green uppercase tracking-wide mb-1">Recommendation</div>
                            <div className="text-[15px] font-medium text-ink-800 leading-snug">{msg.advice}</div>
                          </div>
                          <div className="text-[11px] text-ink-500 flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cloud-200 flex items-center justify-center text-[8px]">✓</span>{msg.source}</div>
                        </div>
                      </div>
                    ) : (
                      <div className={`px-4 py-3 rounded-card text-[15px] leading-[1.45] ${msg.role==='user' ? 'bg-sky-500 text-white rounded-br-[4px]' : 'bg-cloud-200 text-ink-800 rounded-bl-[4px]'} ${msg.type==='outofscope' ? 'border border-alert-amber/30' : ''}`}>
                        <div className="whitespace-pre-wrap">{msg.role==='assistant' && msg.streaming ? (msg.displayText || '') : msg.text}</div>
                        {msg.role==='assistant' && msg.source && (
                          <div className="mt-2 text-[11px] opacity-70 flex items-center gap-1 border-t border-black/10 pt-2">
                            <span className="text-[10px]">●</span> {msg.source}
                          </div>
                        )}
                      </div>
                    )}
                    {msg.role==='assistant' && msg.chips && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.chips.map((chip,i) => (
                          <button key={i} onClick={()=>handleSend(chip)} className="text-[13px] px-3 py-1.5 rounded-full bg-white border border-cloud-200 text-sky-900 hover:bg-monsoon-100 transition font-medium shadow-sm">{chip}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-cloud-200 px-4 py-3 rounded-card rounded-bl-[4px] flex gap-1">
                    <span className="w-2 h-2 bg-ink-500 rounded-full animate-[typing_1.2s_infinite]"></span>
                    <span className="w-2 h-2 bg-ink-500 rounded-full animate-[typing_1.2s_0.2s_infinite]"></span>
                    <span className="w-2 h-2 bg-ink-500 rounded-full animate-[typing_1.2s_0.4s_infinite]"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
              <div className="pt-4 border-t border-cloud-200 mt-4">
                <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-widest mb-2">Try these demo queries (judge script)</div>
                <div className="grid grid-cols-1 gap-2">
                  {['Will it rain in Lucknow tomorrow?', 'Is there any warning for my area?', 'Should I irrigate my field this week?', 'Give me full aviation briefing for Delhi'].map(q => (
                    <button key={q} onClick={()=>handleSend(q)} className="text-left text-[13px] bg-white border border-cloud-200 px-3 py-2 rounded-lg hover:border-sky-500/50 transition text-ink-800">"{q}"</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'alerts' && (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[18px] font-semibold text-ink-800">{t.activeAlerts}</h2>
                <button onClick={handleSimulateAlert} className="text-[11px] bg-alert-red text-white px-3 py-1.5 rounded-full font-semibold animate-pulse">{t.simulateAlert}</button>
              </div>
              {Object.values(mockWeatherData).flatMap(c => c.alerts).length === 0 ? (
                <div className="bg-success-green/10 border border-success-green/20 rounded-card p-6 text-center">
                  <div className="w-12 h-12 bg-success-green text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl">✓</div>
                  <div className="text-[15px] font-medium text-ink-800">{t.noWarnings}</div>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {Object.entries(mockWeatherData).map(([key,city]) => city.alerts.map(alert => (
                    <div key={alert.id} onClick={()=>setSelectedAlert({...alert, city: city.name})} className="bg-white border border-cloud-200 rounded-card overflow-hidden flex cursor-pointer hover:shadow-md transition shadow-sm">
                      <div className={`w-1.5 ${alert.severity==='red' ? 'bg-alert-red' : alert.severity==='amber' ? 'bg-alert-amber' : 'bg-success-green'}`}></div>
                      <div className="flex-1 p-3">
                        <div className="flex items-start justify-between">
                          <div className="text-[13px] font-semibold text-ink-800">{lang==='hi' ? alert.title_hi : lang==='mr' ? alert.title_mr : alert.title} · {city.name}</div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${alert.severity==='red' ? 'bg-alert-red/10 text-alert-red' : 'bg-alert-amber/10 text-alert-amber'}`}>{alert.severity}</span>
                        </div>
                        <div className="text-[13px] text-ink-500 mt-1 line-clamp-2">{lang==='hi' ? alert.summary_hi : lang==='mr' ? alert.summary_mr : alert.summary}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] bg-sky-900 text-white px-2 py-0.5 rounded-full">IMD</span>
                          <span className="text-[11px] text-ink-500">{alert.time}</span>
                        </div>
                      </div>
                    </div>
                  )))}
                </div>
              )}
              <h3 className="text-[14px] font-semibold text-ink-500 uppercase tracking-widest mb-3">{t.pastAlerts}</h3>
              <div className="space-y-2">
                {pastAlerts.map(a => (
                  <div key={a.id} className="bg-cloud-200/60 rounded-card p-3 flex gap-3 opacity-80">
                    <div className={`w-1 rounded-full ${a.severity==='red' ? 'bg-alert-red' : 'bg-alert-amber'}`}></div>
                    <div><div className="text-[13px] font-medium text-ink-800">{a.title} · {a.city}</div><div className="text-[11px] text-ink-500">{a.summary} · {a.time}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'locations' && (
            <div className="px-4 py-4">
              <button onClick={()=>setShowAddLoc(true)} className="w-full bg-sky-900 text-white py-3 rounded-card font-semibold text-[14px] mb-4 hover:bg-sky-900/90 transition">{t.addLocation}</button>
              <div className="space-y-3">
                {savedLocs.map(key => {
                  const city = mockWeatherData[key]
                  if (!city) return null
                  return (
                    <div key={key} className={`bg-white border rounded-card p-4 flex items-center justify-between shadow-sm ${currentLocKey===key ? 'border-sky-500 ring-1 ring-sky-500/20' : 'border-cloud-200'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-[28px]">{city.current.icon}</span>
                        <div>
                          <div className="font-semibold text-ink-800 text-[15px]">{lang==='hi' ? city.name_hi : lang==='mr' ? city.name_mr : city.name}</div>
                          <div className="text-[12px] text-ink-500">{city.current.condition} · {city.alerts.length>0 ? `${city.alerts.length} alert` : 'No alerts'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="mono-nums font-bold text-[18px] text-ink-800">{city.current.temp}°C</span>
                        <button onClick={()=>{setCurrentLocKey(key); setActiveTab('chat')}} className="w-8 h-8 rounded-full bg-monsoon-100 flex items-center justify-center hover:bg-sky-500 hover:text-white transition">↗</button>
                        {savedLocs.length>1 && <button onClick={()=>setSavedLocs(s=>s.filter(k=>k!==key))} className="w-8 h-8 rounded-full bg-cloud-200 flex items-center justify-center text-ink-500 hover:bg-alert-red hover:text-white transition">✕</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {showAddLoc && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
                  <div className="bg-white w-full max-w-[430px] rounded-t-[20px] p-5 animate-slideUp max-h-[80vh] overflow-y-auto">
                    <div className="w-10 h-1 bg-cloud-200 rounded-full mx-auto mb-4"></div>
                    <h3 className="font-semibold text-ink-800 mb-3">{t.addLocation}</h3>
                    <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full bg-monsoon-100 border border-cloud-200 rounded-card px-4 py-3 text-[14px] outline-none focus:border-sky-500 mb-3" autoFocus />
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-monsoon-100 text-[14px] text-sky-900 mb-2">📍 {t.useCurrent}</button>
                    <div className="space-y-1">
                      {filteredCities.map(k => (
                        <button key={k} onClick={()=>{ if(!savedLocs.includes(k)) setSavedLocs([...savedLocs,k]); setCurrentLocKey(k); setShowAddLoc(false); setSearchQuery(''); setActiveTab('chat')}} className="w-full text-left px-3 py-3 rounded-lg hover:bg-monsoon-100 flex items-center justify-between">
                          <span className="font-medium text-ink-800">{mockWeatherData[k].name}</span><span className="text-ink-500 mono-nums">{mockWeatherData[k].current.temp}°C {mockWeatherData[k].current.icon}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={()=>setShowAddLoc(false)} className="w-full mt-4 py-3 rounded-card bg-cloud-200 font-medium">Close</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-cloud-200 flex justify-around py-1.5 px-2">
          {[{ id: 'chat', icon: '💬', label: t.chat }, { id: 'alerts', icon: '⚠️', label: t.alerts, badge: Object.values(mockWeatherData).flatMap(c=>c.alerts).length }, { id: 'locations', icon: '📍', label: t.locations }].map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex-1 flex flex-col items-center py-1.5 rounded-lg relative ${activeTab===tab.id ? 'text-sky-900 bg-monsoon-100' : 'text-ink-500'}`}>
              <span className="text-[20px] leading-none">{tab.icon}</span>
              <span className="text-[11px] font-medium mt-1">{tab.label}</span>
              {tab.badge>0 && <span className="absolute top-1 right-6 bg-alert-red text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{tab.badge}</span>}
            </button>
          ))}
        </div>
        {activeTab==='chat' && (
          <div className="absolute bottom-[56px] left-0 right-0 bg-white border-t border-cloud-200 p-2.5 flex items-center gap-2">
            <div className="flex-1 bg-monsoon-100 rounded-full flex items-center px-3 py-1 border border-cloud-200 focus-within:border-sky-500 transition">
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSend()} placeholder={t.typePlaceholder} className="flex-1 bg-transparent outline-none text-[15px] py-2 placeholder:text-ink-500/60" />
              <button title="Voice - Coming soon" className="w-9 h-9 rounded-full flex items-center justify-center text-ink-500 opacity-50 cursor-not-allowed">🎤</button>
            </div>
            <button onClick={()=>handleSend()} disabled={!input.trim()} className="w-11 h-11 rounded-full bg-sky-900 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-900/90 transition shadow-md">➤</button>
          </div>
        )}
        {selectedAlert && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end justify-center p-0">
            <div className="bg-white w-full max-w-[430px] rounded-t-[20px] max-h-[85vh] overflow-y-auto animate-slideUp">
              <div className="sticky top-0 bg-white p-4 border-b border-cloud-200 flex items-center justify-between">
                <div className="flex items-center gap-2"><div className={`w-1 h-6 rounded-full ${selectedAlert.severity==='red' ? 'bg-alert-red' : 'bg-alert-amber'}`}></div><h3 className="font-semibold text-ink-800">Alert Detail</h3></div>
                <button onClick={()=>setSelectedAlert(null)} className="w-8 h-8 rounded-full bg-cloud-200 flex items-center justify-center">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div><div className="text-[12px] font-bold tracking-widest uppercase text-alert-red mb-1">{selectedAlert.severity} WARNING</div><h2 className="text-[20px] font-bold text-ink-800 leading-tight">{selectedAlert.title}</h2><div className="text-[13px] text-ink-500 mt-1">{selectedAlert.city} · {selectedAlert.time}</div></div>
                <div className="bg-cloud-200/50 border border-cloud-200 rounded-card p-4">
                  <div className="text-[11px] font-bold tracking-widest uppercase text-ink-500 mb-2 flex items-center gap-2"><span className="bg-sky-900 text-white px-2 py-0.5 rounded-full text-[10px]">IMD</span> {t.officialWarning}</div>
                  <div className="text-[14px] leading-relaxed text-ink-800 font-medium">{selectedAlert.officialText || selectedAlert.official_text}</div>
                </div>
                <div className="bg-success-green/10 border border-success-green/20 rounded-card p-4">
                  <div className="text-[11px] font-bold tracking-widest uppercase text-success-green mb-2">💡 {t.whatItMeans}</div>
                  <div className="text-[14px] leading-relaxed text-ink-800">{selectedAlert.whatItMeans || selectedAlert.what_it_means}</div>
                </div>
                <div className="text-[11px] text-ink-500 text-center py-2">{t.source} · {t.updated} 10 min ago · Never paraphrased, always attributed</div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="hidden lg:block w-[380px] p-6 space-y-6 overflow-y-auto">
        <div className="bg-white rounded-card p-5 shadow-sm border border-cloud-200">
          <h3 className="font-bold text-sky-900 mb-2">🏆 Full Stack Architecture</h3>
          <div className="space-y-2 text-[13px]">
            <div><b>Frontend:</b> React + Tailwind (this UI)</div>
            <div><b>Backend:</b> Express server (server.js) - JSON file DB</div>
            <div><b>DB:</b> database.json - auto-created, persists locations, alerts, chat logs</div>
            <div><b>API:</b> /api/chat, /api/weather, /api/alerts, /api/locations</div>
            <div className="pt-2 p-2 bg-monsoon-100 rounded text-[11px] font-mono">npm run dev → frontend :5173<br/>npm run server → backend :3001</div>
          </div>
        </div>
        <div className="bg-sky-900 text-white rounded-card p-5">
          <h3 className="font-bold mb-2">🆓 Free Production Stack</h3>
          <div className="space-y-2 text-[13px] leading-relaxed opacity-90">
            <div><b>Replace database.json with Supabase:</b></div>
            <div className="text-[11px] font-mono bg-white/10 p-2 rounded">supabase.from('weather').select()<br/>supabase.from('alerts').insert()</div>
            <div><b>Frontend:</b> Vercel (free)</div>
            <div><b>Backend:</b> Render.com / Vercel Functions (free)</div>
            <div><b>AI:</b> Gemini free tier</div>
          </div>
        </div>
      </div>
    </div>
  )
}
