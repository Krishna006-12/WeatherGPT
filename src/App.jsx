import React, { useState, useEffect, useRef } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { translations } from './lib/translations.js'
import {
  DEFAULT_INDIAN_CITIES,
  searchCities,
  fetchLiveWeather,
  fetchNwpComparison
} from './lib/weatherService.js'
import { evaluateAgroAdvisory } from './lib/agroDecisionEngine.js'
import {
  INITIAL_SAMPLE_ALERTS,
  createSimulatedAlert,
  playAlertChime
} from './lib/alertsEngine.js'
import {
  parseCopilotIntent,
  generateGroundedResponse,
  startVoiceRecognition,
  speakText,
  stopSpeaking
} from './lib/aiCopilot.js'
import WeatherAnimations from './components/WeatherAnimations.jsx'
import RuralRelayModal from './components/RuralRelayModal.jsx'
import SihMatrixModal from './components/SihMatrixModal.jsx'

export default function App() {
  // State management
  const [lang, setLang] = useState('en')
  const [activeCity, setActiveCity] = useState(DEFAULT_INDIAN_CITIES[0]) // Lucknow
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  // Weather data
  const [weatherData, setWeatherData] = useState(null)
  const [nwpData, setNwpData] = useState(null)
  const [agroData, setAgroData] = useState(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)

  // Mode: 'farm' | 'urban' | 'school' | 'ops'
  const [activeMode, setActiveMode] = useState('farm')

  // Mobile/Tablet Tab: 'forecast' | 'agri' | 'copilot' | 'alerts' | 'nwp'
  const [mobileTab, setMobileTab] = useState('forecast')

  // Alerts & Rural Relay
  const [activeAlerts, setActiveAlerts] = useState(INITIAL_SAMPLE_ALERTS)
  const [selectedRelayAlert, setSelectedRelayAlert] = useState(null)
  const [showSihMatrix, setShowSihMatrix] = useState(false)

  // AI Copilot Chat & Voice
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isListeningVoice, setIsListeningVoice] = useState(false)
  const [isPlayingTts, setIsPlayingTts] = useState(false)
  const chatBottomRef = useRef(null)

  const t = translations[lang] || translations.en

  // Load weather when city changes
  useEffect(() => {
    let isMounted = true
    async function loadData() {
      setIsLoadingWeather(true)
      const wData = await fetchLiveWeather(activeCity)
      const nData = await fetchNwpComparison(activeCity)
      if (isMounted) {
        setWeatherData(wData)
        setNwpData(nData)
        const agro = evaluateAgroAdvisory(wData, lang)
        setAgroData(agro)
        setIsLoadingWeather(false)

        // Initialize welcome message for new city
        const welcome = generateGroundedResponse({ intent: 'general', targetCity: activeCity.key }, wData, nData, activeAlerts, lang)
        setChatMessages([
          {
            id: Date.now(),
            role: 'assistant',
            ...welcome,
            timestamp: new Date()
          }
        ])
      }
    }
    loadData()
    return () => { isMounted = false }
  }, [activeCity, lang])

  // Handle City Search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      const results = await searchCities(searchQuery)
      setSearchResults(results)
      setIsSearching(false)
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Auto scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  // Send Chat message with dynamic worldwide geocoding
  const handleSendChat = async (messageText = chatInput) => {
    if (!messageText.trim() || !weatherData) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: messageText,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setIsTyping(true)

    try {
      const intentObj = await parseCopilotIntent(messageText, activeCity.key)
      let targetWeather = weatherData
      let targetNwp = nwpData

      // If user queried about another city (e.g. New York, London, Kanpur, Patna)
      if (intentObj.resolvedCity) {
        if (intentObj.resolvedCity.lat !== activeCity.lat || intentObj.resolvedCity.lon !== activeCity.lon) {
          setActiveCity(intentObj.resolvedCity)
          targetWeather = await fetchLiveWeather(intentObj.resolvedCity)
          targetNwp = await fetchNwpComparison(intentObj.resolvedCity)
          setWeatherData(targetWeather)
          setNwpData(targetNwp)
          const agro = evaluateAgroAdvisory(targetWeather, lang)
          setAgroData(agro)
        }
      }

      const botResp = generateGroundedResponse(intentObj, targetWeather, targetNwp, activeAlerts, lang)
      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        ...botResp,
        timestamp: new Date()
      }
      setIsTyping(false)
      setChatMessages(prev => [...prev, botMsg])
    } catch (err) {
      console.warn('Chat copilot processing error:', err)
      const fallbackResp = generateGroundedResponse({ intent: 'general' }, weatherData, nwpData, activeAlerts, lang)
      setIsTyping(false)
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', ...fallbackResp, timestamp: new Date() }])
    }
  }

  // Voice Input Handler
  const handleToggleVoice = () => {
    if (isListeningVoice) {
      setIsListeningVoice(false)
      return
    }

    setIsListeningVoice(true)
    startVoiceRecognition(
      lang,
      (transcript) => {
        setIsListeningVoice(false)
        if (transcript) {
          handleSendChat(transcript)
        }
      },
      (error) => {
        console.warn('Voice error:', error)
        setIsListeningVoice(false)
      },
      () => {
        setIsListeningVoice(false)
      }
    )
  }

  // Audio Readout (TTS)
  const handleSpeakMsg = (text) => {
    if (isPlayingTts) {
      stopSpeaking()
      setIsPlayingTts(false)
    } else {
      setIsPlayingTts(true)
      speakText(text, lang)
      setTimeout(() => setIsPlayingTts(false), 9000)
    }
  }

  // Simulate District Red Alert Trigger
  const handleSimulateAlert = () => {
    playAlertChime('red')
    const newAlert = createSimulatedAlert(activeCity, 'red')
    setActiveAlerts(prev => [newAlert, ...prev])
    setSelectedRelayAlert(newAlert)
    
    // Add alert notification in chat
    const alertMsg = {
      id: Date.now(),
      role: 'assistant',
      type: 'alert',
      text: lang === 'hi' 
        ? `🚨 नया रेड अलर्ट: ${newAlert.title_hi}\n\nविवरण: ${newAlert.summary_hi}` 
        : `🚨 NEW RED ALERT TRIGGERED: ${newAlert.title}\n\nDetails: ${newAlert.summary}`,
      alertData: newAlert,
      source: 'State Disaster Management Authority (SDMA) · Live Simulation',
      chips: lang === 'hi' ? ['ग्रामीण SMS रिले खोलें', 'लाउडस्पीकर ऑडियो', 'सुरक्षा निर्देश'] : ['Open Rural SMS Relay', 'Loudspeaker Script', 'Safety Actions'],
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, alertMsg])
  }

  const current = weatherData?.current || { temp: 30, feelsLike: 33, condition: 'Clear Sky', icon: '☀️', humidity: 55, windSpeed: 10, pressure: 1012, uvIndex: 6, isDay: true, type: 'clear' }
  const aqi = weatherData?.airQuality || { aqi: 78, category: 'Moderate', color: '#C97A1A' }

  return (
    <div className="min-h-screen w-full bg-[#0B1F3A] text-ink-800 flex flex-col relative overflow-x-hidden">
      {/* Dynamic Background Atmosphere */}
      <WeatherAnimations weatherType={current.type} isDay={current.isDay} isRain={current.isRain} />

      {/* Top Universal Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0B1F3A]/90 backdrop-blur-xl border-b border-white/10 px-4 py-2.5 text-white flex items-center justify-between shadow-lg">
        {/* Brand & Live Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowSihMatrix(true)}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-sky-400 flex items-center justify-center font-bold text-white shadow-md text-base">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">{t.appName}</span>
                <span className="text-[10px] bg-sky-500/30 text-sky-300 font-semibold px-1.5 py-0.5 rounded border border-sky-400/30 font-mono">SIH'26</span>
              </div>
              <div className="text-[10px] text-white/60 hidden sm:block">{t.tagline}</div>
            </div>
          </div>
        </div>

        {/* Center: City Search Bar with Geocoding Dropdown */}
        <div className="flex-1 max-w-md mx-3 relative">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-white/50 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder:text-white/40 text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-white/15 focus:border-sky-400 outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                className="absolute right-2.5 text-white/60 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Search Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0F3D5C] border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 animate-slideUp">
              <div className="p-1.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider px-3 border-b border-white/10">
                Indian Cities & Districts ({searchResults.length})
              </div>
              <div className="max-h-60 overflow-y-auto">
                {searchResults.map((city) => (
                  <button
                    key={`${city.lat}_${city.lon}`}
                    onClick={() => {
                      setActiveCity(city)
                      setSearchQuery('')
                      setShowSearchDropdown(false)
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-white/15 flex items-center justify-between text-xs transition border-b border-white/5 last:border-0"
                  >
                    <div>
                      <span className="font-semibold text-white">{lang === 'hi' && city.name_hi ? city.name_hi : city.name}</span>
                      <span className="text-white/50 text-[11px] ml-2">({city.state})</span>
                    </div>
                    <span className="text-sky-300 font-mono text-[10px]">Select ↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Tools: Mode Switcher, Language & Red Alert Trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Domain Mode Dropdown */}
          <select
            value={activeMode}
            onChange={(e) => setActiveMode(e.target.value)}
            className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-white/15 outline-none cursor-pointer hidden md:block"
          >
            <option value="farm" className="bg-[#0F3D5C] text-white">🌾 Farmer Mode</option>
            <option value="urban" className="bg-[#0F3D5C] text-white">🏙️ Urban / Commuter</option>
            <option value="school" className="bg-[#0F3D5C] text-white">🏫 School Heatwave</option>
            <option value="ops" className="bg-[#0F3D5C] text-white">🚨 Disaster Ops</option>
          </select>

          {/* Multilingual Selector (6 Indic Languages) */}
          <div className="flex bg-white/10 rounded-xl p-0.5 border border-white/15">
            {[
              { code: 'en', label: 'EN' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'mr', label: 'मराठी' },
              { code: 'bn', label: 'বাংলা' },
              { code: 'te', label: 'తెలుగు' },
              { code: 'pa', label: 'ਪੰਜਾਬੀ' }
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  lang === l.code ? 'bg-white text-sky-900 shadow-sm' : 'text-white/70 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Trigger Red Alert Quick Simulator */}
          <button
            onClick={handleSimulateAlert}
            title="Simulate incoming district emergency alert"
            className="bg-alert-red hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition animate-pulse"
          >
            <span>🚨</span>
            <span className="hidden sm:inline">Simulate Red Alert</span>
          </button>

          {/* SIH Matrix Modal Button */}
          <button
            onClick={() => setShowSihMatrix(true)}
            className="bg-white/15 hover:bg-white/25 text-white font-bold text-xs p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1"
            title="View SIH Round 2 Evaluation Matrix"
          >
            <span>🏆</span>
            <span className="hidden lg:inline">{t.sihMatrix}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Responsive Multi-Column Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 z-10">
        
        {/* ================= LEFT / CENTER REGION: Meteorological & Agro Dashboard (lg:col-span-8) ================= */}
        <div className="lg:col-span-8 flex flex-col space-y-4 md:space-y-6">
          
          {/* Active District Red Alert Banner (if any) */}
          {activeAlerts.length > 0 && (
            <div className={`p-4 rounded-2xl text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slideUp ${
              activeAlerts[0].severity === 'red' ? 'bg-gradient-to-r from-alert-red to-red-700' : 'bg-gradient-to-r from-alert-amber to-amber-600'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl animate-bounce">⚠️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-black/30 px-2 py-0.5 rounded font-bold">
                      {activeAlerts[0].severity.toUpperCase()} WARNING
                    </span>
                    <span className="text-xs opacity-90">{activeAlerts[0].issuedBy}</span>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base mt-0.5">
                    {lang === 'hi' && activeAlerts[0].title_hi ? activeAlerts[0].title_hi : activeAlerts[0].title}
                  </h3>
                  <p className="text-xs opacity-90 line-clamp-1 mt-0.5">
                    {lang === 'hi' && activeAlerts[0].summary_hi ? activeAlerts[0].summary_hi : activeAlerts[0].summary}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRelayAlert(activeAlerts[0])}
                className="whitespace-nowrap bg-white text-ink-800 hover:bg-monsoon-100 font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5"
              >
                <span>📢</span> Open Rural Relay Studio
              </button>
            </div>
          )}

          {/* Quick City Carousel Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {DEFAULT_INDIAN_CITIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveCity(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeCity.key === c.key
                    ? 'bg-sky-500 text-white shadow-md border border-sky-400'
                    : 'bg-white/10 hover:bg-white/20 text-white/90 border border-white/10'
                }`}
              >
                <span>📍</span>
                <span>{lang === 'hi' && c.name_hi ? c.name_hi : c.name}</span>
              </button>
            ))}
          </div>

          {/* HERO WEATHER DECK (Glassmorphism & Live Metrics) */}
          <div className="glass-card rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
            {/* Top Row: Location & Live Status */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest font-mono text-sky-900/70 font-bold">
                    {activeCity.state}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-success-green/10 text-success-green text-[10px] font-bold px-2 py-0.5 rounded-full border border-success-green/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-green animate-ping" />
                    LIVE MET
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-sky-900 tracking-tight mt-1">
                  {lang === 'hi' && activeCity.name_hi ? activeCity.name_hi : activeCity.name}
                </h1>
                <div className="text-xs text-ink-500 mt-0.5">
                  {t.sourceAttribution} · {weatherData?.updatedAt || t.updatedAgo}
                </div>
              </div>

              {/* Weather Condition Badge & Icon */}
              <div className="text-right">
                <div className="text-4xl sm:text-6xl drop-shadow-md">{current.icon}</div>
                <div className="text-xs sm:text-sm font-bold text-sky-900 mt-1">{current.condition}</div>
              </div>
            </div>

            {/* Middle Row: Temperature & Key Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
              {/* Main Temp */}
              <div className="col-span-2 bg-gradient-to-br from-sky-900 to-sky-800 text-white rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-lg">
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/70 font-semibold">{t.currentWeather}</div>
                  <div className="text-4xl sm:text-5xl font-black mono-nums mt-1">{current.temp}°C</div>
                  <div className="text-xs text-white/80 mt-1">
                    {t.feelsLike} <span className="font-bold mono-nums">{current.feelsLike}°C</span>
                  </div>
                </div>
                <div className="text-right space-y-1 text-xs text-white/80 font-medium">
                  <div>Max: <span className="font-bold mono-nums text-white">{weatherData?.daily?.[0]?.maxTemp || 33}°C</span></div>
                  <div>Min: <span className="font-bold mono-nums text-white">{weatherData?.daily?.[0]?.minTemp || 24}°C</span></div>
                  <div>Rain: <span className="font-bold mono-nums text-sky-300">{weatherData?.daily?.[0]?.pop || 10}%</span></div>
                </div>
              </div>

              {/* Humidity Metric */}
              <div className="bg-monsoon-100 border border-cloud-200 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="text-[11px] text-ink-500 font-semibold uppercase">{t.humidity}</div>
                <div className="text-2xl font-black text-sky-900 mono-nums my-1">{current.humidity}%</div>
                <div className="w-full bg-cloud-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: `${current.humidity}%` }} />
                </div>
              </div>

              {/* Wind Speed & Compass */}
              <div className="bg-monsoon-100 border border-cloud-200 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="text-[11px] text-ink-500 font-semibold uppercase">{t.windSpeed}</div>
                <div className="text-2xl font-black text-sky-900 mono-nums my-1">{current.windSpeed} <span className="text-xs font-normal">km/h</span></div>
                <div className="text-[11px] text-ink-500 flex items-center gap-1">
                  <span>🧭</span> Wind Dir: {current.windDirection}°
                </div>
              </div>
            </div>

            {/* Sub-Metrics Strip: UV, Pressure, Soil & AQI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-cloud-200/80 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-cloud-200">
                <span className="text-lg">☀️</span>
                <div>
                  <div className="text-[10px] text-ink-500 uppercase">{t.uvIndex}</div>
                  <div className="font-bold text-sky-900 mono-nums">{current.uvIndex} / 11</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-cloud-200">
                <span className="text-lg">🎛️</span>
                <div>
                  <div className="text-[10px] text-ink-500 uppercase">{t.pressure}</div>
                  <div className="font-bold text-sky-900 mono-nums">{current.pressure} hPa</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-cloud-200">
                <span className="text-lg">🌱</span>
                <div>
                  <div className="text-[10px] text-ink-500 uppercase">{t.soilMoisture}</div>
                  <div className="font-bold text-sky-900 mono-nums">{weatherData?.agri?.soilPercentage || 62}%</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-cloud-200">
                <span className="text-lg">💨</span>
                <div>
                  <div className="text-[10px] text-ink-500 uppercase">{t.aqi}</div>
                  <div className="font-bold mono-nums" style={{ color: aqi.color }}>
                    {aqi.aqi} ({aqi.category})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 24-HOUR INTERACTIVE HOURLY FORECAST SLIDER */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sky-900 text-sm sm:text-base flex items-center gap-2">
                <span>⏱️</span> {t.hourly24h}
              </h3>
              <span className="text-xs text-ink-500 font-mono">24-Hour Met Trend</span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
              {(weatherData?.hourly || []).map((h, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 w-20 p-2.5 rounded-xl border text-center flex flex-col items-center justify-between transition ${
                    i === 0
                      ? 'bg-sky-900 text-white border-sky-900 shadow-md'
                      : 'bg-monsoon-100 hover:bg-white text-ink-800 border-cloud-200'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${i === 0 ? 'text-white/80' : 'text-ink-500'}`}>{h.time}</div>
                  <div className="text-xl my-1">{h.icon}</div>
                  <div className="font-bold mono-nums text-sm">{h.temp}°C</div>
                  <div className={`text-[10px] mono-nums mt-1 ${i === 0 ? 'text-sky-300' : 'text-sky-600'} font-semibold`}>
                    💧 {h.pop}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GRAMIN KRISHI MAUSAM ADVISORY DECK (AGRO-DECISION ENGINE) */}
          <div className="glass-card rounded-2xl p-5 shadow-xl border-l-4 border-l-success-green">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌾</span>
                  <h3 className="font-extrabold text-sky-900 text-base">{t.agriTitle}</h3>
                </div>
                <div className="text-xs text-ink-500 mt-0.5">ICAR & IMD Decision Support System for Farmers</div>
              </div>
              <span className="text-xs bg-success-green/10 text-success-green font-bold px-2.5 py-1 rounded-full border border-success-green/20">
                Decision Support
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Irrigation Card */}
              <div className="p-4 rounded-xl bg-monsoon-100 border border-cloud-200 space-y-1.5">
                <div className="text-xs font-bold text-sky-900 flex items-center justify-between">
                  <span>🚰 {t.irrigationStatus}</span>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agroData?.irrigation?.statusColor || '#2E7D5B' }} />
                </div>
                <div className="font-bold text-sm text-ink-800">{agroData?.irrigation?.title}</div>
                <div className="text-xs text-ink-500 leading-relaxed">{agroData?.irrigation?.reason}</div>
              </div>

              {/* Pesticide Spray Window */}
              <div className="p-4 rounded-xl bg-monsoon-100 border border-cloud-200 space-y-1.5">
                <div className="text-xs font-bold text-sky-900 flex items-center justify-between">
                  <span>🧪 {t.sprayWindow}</span>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agroData?.spray?.statusColor || '#2E7D5B' }} />
                </div>
                <div className="font-bold text-sm text-ink-800">{agroData?.spray?.title}</div>
                <div className="text-xs text-ink-500 leading-relaxed">{agroData?.spray?.reason}</div>
              </div>
            </div>

            {/* Root-Zone Soil & ET Matrix */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-cloud-200 text-center text-xs">
              <div className="bg-white/80 p-2 rounded-lg border border-cloud-200">
                <div className="text-[10px] text-ink-500 uppercase">{t.soilHealth} (0–7cm)</div>
                <div className="font-extrabold text-sky-900 mono-nums text-sm">{Math.round((weatherData?.agri?.soilMoisture0_7 || 0.26) * 100)}%</div>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-cloud-200">
                <div className="text-[10px] text-ink-500 uppercase">Sub-Soil (7–28cm)</div>
                <div className="font-extrabold text-sky-900 mono-nums text-sm">{Math.round((weatherData?.agri?.soilMoisture7_28 || 0.31) * 100)}%</div>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-cloud-200">
                <div className="text-[10px] text-ink-500 uppercase">{t.etRate}</div>
                <div className="font-extrabold text-sky-900 mono-nums text-sm">{weatherData?.agri?.dailyEt0 || 3.8} mm/day</div>
              </div>
            </div>
          </div>

          {/* MULTI-MODEL NWP ENSEMBLE COMPARISON (GFS vs ECMWF vs ICON) */}
          <div className="glass-card rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-sky-900 text-sm sm:text-base flex items-center gap-2">
                  <span>🌐</span> {t.nwpTitle}
                </h3>
                <div className="text-xs text-ink-500">Multi-Model Precipitation Spread & Ensemble Variance</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-sky-900 mono-nums bg-monsoon-100 px-2.5 py-1 rounded-lg border border-cloud-200">
                  {nwpData?.agreementScore || 88}% Agreement
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
              {(nwpData?.models || []).map((m, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-monsoon-100 border border-cloud-200 text-center space-y-1">
                  <div className="text-xs font-bold text-sky-900">{m.name}</div>
                  <div className="text-lg font-black mono-nums" style={{ color: m.color }}>
                    {m.rainTomorrow} <span className="text-xs font-normal">mm rain</span>
                  </div>
                  <div className="text-[11px] text-ink-500 mono-nums">Max Temp: {m.maxTemp}°C</div>
                </div>
              ))}
            </div>

            <div className="bg-sky-900/5 p-3 rounded-xl border border-sky-900/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-900">Ensemble Consensus Blend:</span>
              <span className="font-bold text-sky-900 mono-nums">~{nwpData?.blendRain || 14.5} mm rainfall tomorrow ({nwpData?.confidenceText || 'High Confidence'})</span>
            </div>
          </div>

          {/* 7-DAY EXTENDED FORECAST */}
          <div className="glass-card rounded-2xl p-5 shadow-lg">
            <h3 className="font-bold text-sky-900 text-sm sm:text-base mb-3 flex items-center gap-2">
              <span>📅</span> {t.daily7d}
            </h3>
            <div className="space-y-2">
              {(weatherData?.daily || []).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-monsoon-100 hover:bg-white border border-cloud-200 transition text-xs"
                >
                  <div className="w-24 font-bold text-sky-900">{d.day}</div>
                  <div className="flex items-center gap-2 w-36">
                    <span className="text-lg">{d.icon}</span>
                    <span className="text-ink-500 truncate">{d.condition}</span>
                  </div>
                  <div className="w-24 text-sky-600 font-semibold mono-nums">
                    💧 {d.pop}% ({d.rainSum}mm)
                  </div>
                  <div className="font-bold mono-nums text-ink-800 text-right w-20">
                    <span className="text-sky-900">{d.maxTemp}°</span> / <span className="text-ink-500">{d.minTemp}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>


        {/* ================= RIGHT REGION: Grounded AI Copilot & Voice Hub (lg:col-span-4) ================= */}
        <div className="lg:col-span-4 flex flex-col h-full min-h-[600px] glass-card rounded-3xl overflow-hidden shadow-2xl border border-cloud-200">
          {/* Chat Header */}
          <div className="p-4 bg-sky-900 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                🤖
              </div>
              <div>
                <h2 className="font-bold text-sm leading-tight">{t.chat}</h2>
                <div className="text-[10px] text-sky-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-green animate-pulse" />
                  Grounded & Anti-Hallucinating
                </div>
              </div>
            </div>
            <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full font-mono">
              v2.6 Live
            </span>
          </div>

          {/* Chat Message Scrollable Container */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-monsoon-100/60 text-xs">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
              >
                <div className={`max-w-[88%] space-y-1.5 ${msg.role === 'user' ? 'order-2' : ''}`}>
                  {/* User Message Bubble */}
                  {msg.role === 'user' ? (
                    <div className="bg-sky-900 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm font-medium leading-relaxed">
                      {msg.text}
                    </div>
                  ) : (
                    /* Assistant Message Bubble */
                    <div className={`p-3.5 rounded-2xl rounded-tl-sm shadow-sm border ${
                      msg.type === 'alert'
                        ? 'bg-red-50 border-alert-red/30 text-red-950'
                        : msg.type === 'outofscope'
                        ? 'bg-amber-50 border-alert-amber/30 text-amber-950'
                        : 'bg-white border-cloud-200 text-ink-800'
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed font-medium">
                        {msg.text}
                      </div>

                      {/* Source Citation */}
                      {msg.source && (
                        <div className="mt-2.5 pt-2 border-t border-black/5 text-[10px] text-ink-500 flex items-center justify-between">
                          <span className="truncate">✓ {msg.source}</span>
                          <button
                            onClick={() => handleSpeakMsg(msg.text)}
                            className="ml-2 text-sky-900 hover:text-sky-600 font-bold flex items-center gap-0.5 whitespace-nowrap"
                          >
                            <span>🔊</span> Listen
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggestion Chips */}
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.chips.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendChat(chip)}
                          className="text-[11px] bg-white hover:bg-sky-50 text-sky-900 font-semibold px-2.5 py-1 rounded-full border border-cloud-200 shadow-2xs transition"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-sm border border-cloud-200 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 bg-sky-900 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-sky-900 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 bg-sky-900 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Judge Quick-Demo Prompts Bar */}
          <div className="px-3 py-2 bg-white border-t border-cloud-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5 flex items-center justify-between">
              <span>🎯 {t.demoPromptsTitle}</span>
              <span className="text-[9px] bg-monsoon-100 px-1.5 py-0.5 rounded text-sky-900 font-semibold">1-Click Test</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {t.demoQueries.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChat(q)}
                  className="whitespace-nowrap text-[11px] bg-monsoon-100 hover:bg-sky-100 text-sky-900 px-2.5 py-1 rounded-lg border border-cloud-200 transition font-medium"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Input & Voice Controls Footer */}
          <div className="p-3 bg-white border-t border-cloud-200 flex items-center gap-2">
            <div className="flex-1 bg-monsoon-100 rounded-2xl flex items-center px-3 py-1.5 border border-cloud-200 focus-within:border-sky-500 transition">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder={isListeningVoice ? t.voiceListening : t.typePlaceholder}
                className="flex-1 bg-transparent text-xs sm:text-sm text-ink-800 outline-none placeholder:text-ink-500/60"
              />
              
              {/* Voice STT Microphone Button */}
              <button
                onClick={handleToggleVoice}
                title="Voice input (Speech to Text)"
                className={`p-1.5 rounded-full transition ${
                  isListeningVoice
                    ? 'bg-alert-red text-white animate-pulse'
                    : 'text-ink-500 hover:text-sky-900 hover:bg-cloud-200'
                }`}
              >
                🎤
              </button>
            </div>

            {/* Send Button */}
            <button
              onClick={() => handleSendChat()}
              disabled={!chatInput.trim()}
              className="w-9 h-9 rounded-2xl bg-sky-900 hover:bg-sky-900/90 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition"
            >
              ➤
            </button>
          </div>
        </div>
      </main>

      {/* Footer & Honesty Citation */}
      <footer className="w-full bg-[#0B1F3A] border-t border-white/10 py-3 px-4 text-center text-xs text-white/50 z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>WeatherGPT · Smart India Hackathon 2026 Grand Finale Architecture</div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSihMatrix(true)} className="hover:text-white underline">
              SIH Matrix
            </button>
            <a href="/HONESTY.txt" target="_blank" className="hover:text-white underline">
              Honesty Sheet
            </a>
            <a href="/IMPACT_AND_SCALE.txt" target="_blank" className="hover:text-white underline">
              Cost Model
            </a>
          </div>
        </div>
      </footer>

      {/* Rural Relay Modal */}
      {selectedRelayAlert && (
        <RuralRelayModal
          alert={selectedRelayAlert}
          onClose={() => setSelectedRelayAlert(null)}
          lang={lang}
        />
      )}

      {/* SIH Evaluation Matrix Modal */}
      {showSihMatrix && (
        <SihMatrixModal onClose={() => setShowSihMatrix(false)} />
      )}

      {/* Vercel Speed Insights */}
      <SpeedInsights />
    </div>
  )
}
