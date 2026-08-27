<<<<<<< HEAD
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CloudSun,
  MessageCircle,
  Bell,
  Layers,
  LayoutDashboard,
  Languages,
  Info,
  X,
  Radio,
  Sprout,
  Car,
  GraduationCap,
  RefreshCw,
  Settings,
  MapPin,
  CalendarDays,
  Activity,
} from 'lucide-react'
import { CITIES, CITY_LIST, getCity, registerCity } from './data/cities'
import { tr } from './data/i18n'
import { fetchWeather, injectSimulatedAlert, clearCache } from './services/weather'
import {
  chat,
  welcomeMessage,
  resolveMentionedCity,
  isCropQuestion,
  detectCrop,
  classifyUserQuery,
  isCropRoute,
  isCropOnlyClassification,
} from './services/ai'
import { fetchAQI } from './services/aqi'
import {
  loadPrefs,
  savePrefs,
  loadOnboarded,
  setOnboarded,
  loadChatHistory,
  saveChatHistory,
  toDisplayTemp,
  tempUnitLabel,
} from './services/storage'
import { dbLogAlert } from './services/db'
import { WeatherIcon, SeverityDot } from './components/Icons'
// Eager: home dashboard (first paint). Rest: code-split for low bandwidth.
import DashboardTab from './components/DashboardTab'
const ChatTab = lazy(() => import('./components/ChatTab'))
const AlertsTab = lazy(() => import('./components/AlertsTab'))
const FarmTab = lazy(() => import('./components/FarmTab'))
const ForecastTab = lazy(() => import('./components/ForecastTab'))
const CitiesTab = lazy(() => import('./components/CitiesTab'))
const TravelTab = lazy(() => import('./components/TravelTab'))
const SchoolTab = lazy(() => import('./components/SchoolTab'))
const ClimateTab = lazy(() => import('./components/ClimateTab'))
const SettingsTab = lazy(() => import('./components/SettingsTab'))
const Onboarding = lazy(() => import('./components/Onboarding'))

function TabFallback() {
  return (
    <div className="h-full page-pad py-4 space-y-3">
      <div className="skel skel-line-lg" />
      <div className="skel skel-card" />
      <div className="skel skel-card" />
      <div className="skel skel-row" />
    </div>
  )
}
import { useAlertMonitor } from './hooks/useAlertMonitor'

const TABS = [
  { id: 'home', icon: LayoutDashboard, labelKey: 'home' },
  { id: 'chat', icon: MessageCircle, labelKey: 'chat' },
  { id: 'alerts', icon: Bell, labelKey: 'alerts' },
  { id: 'modes', icon: Layers, labelKey: 'modes' },
  { id: 'more', icon: Settings, labelKey: 'more' },
]

const SIDEBAR_NAV = [
  { id: 'home', icon: LayoutDashboard, en: 'Dashboard', hi: 'डैशबोर्ड' },
  { id: 'chat', icon: MessageCircle, en: 'AI Chat', hi: 'AI चैट' },
  { id: 'alerts', icon: Bell, en: 'Alerts', hi: 'अलर्ट' },
  { id: 'modes', icon: Layers, en: 'Decision modes', hi: 'निर्णय मोड' },
  { id: 'forecast', icon: CalendarDays, en: 'Forecast', hi: 'पूर्वानुमान', more: 'forecast' },
  { id: 'climate', icon: Activity, en: 'Climate & NWP', hi: 'जलवायु व NWP', more: 'climate' },
  { id: 'locations', icon: MapPin, en: 'Cities', hi: 'शहर', more: 'locations' },
  { id: 'settings', icon: Settings, en: 'Settings', hi: 'सेटिंग्स', more: 'settings' },
]

const MODE_PANELS = [
  { id: 'farm', icon: Sprout, labelEn: 'Farm', labelHi: 'कृषि' },
  { id: 'travel', icon: Car, labelEn: 'Travel', labelHi: 'यात्रा' },
  { id: 'school', icon: GraduationCap, labelEn: 'School', labelHi: 'स्कूल' },
]

const MORE_PANELS = [
  { id: 'forecast', en: 'Forecast', hi: 'पूर्वानुमान' },
  { id: 'climate', en: 'Climate', hi: 'जलवायु' },
  { id: 'locations', en: 'Cities', hi: 'शहर' },
  { id: 'settings', en: 'Settings', hi: 'सेटिंग्स' },
]

function isBogusCropCity(c) {
  if (!c) return true
  const name = String(c.name || '')
  const id = String(c.id || '')
  // Wheat US / Potato Point AU style junk from geocode
  if (detectCrop(name) || detectCrop(id) || isCropQuestion(name)) return true
  const first = name.split(/\s+/)[0]
  if (detectCrop(first) && (c.population || 0) < 80000) return true
  return false
}

function loadRecent() {
  try {
    const raw = localStorage.getItem('weathergpt_recent_cities')
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const cleaned = arr
      .map((c) => registerCity(c))
      .filter((c) => c && !isBogusCropCity(c))
    // Persist scrub so Wheat/Potato don't reappear after reload
    if (cleaned.length !== arr.length) {
      try {
        localStorage.setItem('weathergpt_recent_cities', JSON.stringify(cleaned.slice(0, 12)))
      } catch {
        /* ignore */
      }
    }
    return cleaned
  } catch {
    return []
  }
}

function saveRecent(list) {
  try {
    const clean = (list || []).filter((c) => c && !isBogusCropCity(c)).slice(0, 12)
    localStorage.setItem('weathergpt_recent_cities', JSON.stringify(clean))
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [prefs, setPrefs] = useState(() => loadPrefs())
  const lang = prefs.lang || 'en'
  const [tab, setTab] = useState('home')
  const [modePanel, setModePanel] = useState(prefs.defaultMode || 'travel')
  const [morePanel, setMorePanel] = useState('forecast')
  const [cityId, setCityId] = useState(prefs.homeCityId || 'kanpur')
  const [cityObj, setCityObj] = useState(() => CITIES[prefs.homeCityId] || CITIES.kanpur)
  const [weather, setWeather] = useState(null)
  const [weatherMap, setWeatherMap] = useState({})
  const [aqi, setAqi] = useState(null)
  const [loadingWx, setLoadingWx] = useState(true)
  const [messages, setMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  /** Last crop discussed — follow-ups like "will rain affect it?" */
  const [cropContext, setCropContext] = useState(null)
  const [showAbout, setShowAbout] = useState(false)
  const [minsAgo, setMinsAgo] = useState(1)
  const [recentCities, setRecentCities] = useState(() => loadRecent())
  const [showOnboard, setShowOnboard] = useState(() => !loadOnboarded())
  const [toast, setToast] = useState(null)
=======
import React, { useState, useEffect, useRef } from 'react'
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
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0

  // Weather data
  const [weatherData, setWeatherData] = useState(null)
  const [nwpData, setNwpData] = useState(null)
  const [agroData, setAgroData] = useState(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)

<<<<<<< HEAD
  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  // Dynamic document title for SEO / tab label
  useEffect(() => {
    try {
      const name = city?.name || 'WeatherGPT'
      if (weather?.current) {
        const t = weather.current.temp
        const c = weather.current.condition || ''
        document.title = `${t}° · ${name} · ${c} | WeatherGPT`
      } else {
        document.title = `${name} · WeatherGPT`
      }
    } catch {
      /* */
    }
  }, [city?.name, weather?.current?.temp, weather?.current?.condition])

  // Deep-link: /?tab=alerts from notification click
=======
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
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0
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

<<<<<<< HEAD
  const updatePrefs = useCallback((next) => {
    setPrefs(next)
    savePrefs(next)
  }, [])

  const pushRecent = useCallback((c) => {
    if (!c?.id) return
    if (isBogusCropCity(c)) return
    registerCity(c)
    setRecentCities((prev) => {
      const next = [c, ...prev.filter((x) => x.id !== c.id && !isBogusCropCity(x))].slice(0, 12)
      saveRecent(next)
      return next
    })
  }, [])

  const loadAqi = useCallback(async (c) => {
    if (!c?.lat) return
    try {
      const a = await fetchAQI(c.lat, c.lon)
      setAqi(a)
    } catch {
      setAqi(null)
    }
  }, [])

  const loadCity = useCallback(
    async (idOrCity, { resetChat = false, force = false } = {}) => {
      const resolved =
        typeof idOrCity === 'object' && idOrCity?.lat
          ? registerCity(idOrCity)
          : getCity(idOrCity) || CITIES[idOrCity] || CITIES.kanpur

      setLoadingWx(true)
      setCityId(resolved.id)
      setCityObj(resolved)
      pushRecent(resolved)
      try {
        if (force) clearCache(resolved.id)
        const wx = await fetchWeather(resolved, { force })
        setWeather(wx)
        setWeatherMap((m) => ({ ...m, [resolved.id]: wx }))
        loadAqi(resolved)

        if (resetChat) {
          const hist = loadChatHistory(resolved.id)
          if (hist?.length) {
            setMessages(hist)
          } else {
            setMessages([
              { id: Date.now(), role: 'assistant', ...welcomeMessage(wx, lang), timestamp: Date.now() },
            ])
          }
        }
      } catch {
        showToast(
          lang === 'hi'
            ? 'मौसम लोड नहीं हुआ — नेटवर्क जाँचें या दोबारा कोशिश करें'
            : 'Could not load weather — check network and try again',
          'err'
        )
      } finally {
        setLoadingWx(false)
      }
    },
    [lang, pushRecent, loadAqi, showToast]
  )
=======
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
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0

    try {
<<<<<<< HEAD
      clearCache(city.id)
      const wx = await fetchWeather(city, { force: true })
      setWeather(wx)
      setWeatherMap((m) => ({ ...m, [city.id]: wx }))
      await loadAqi(city)
    } catch {
      showToast(
        lang === 'hi' ? 'रिफ़्रेश असफल — कैश/ऑफ़लाइन देखें' : 'Refresh failed — showing last good if any',
        'err'
      )
    } finally {
      setLoadingWx(false)
    }
  }, [city, loadAqi, showToast, lang])

  useEffect(() => {
    let cancelled = false
    const home = CITIES[prefs.homeCityId] || CITIES.kanpur
    ;(async () => {
      setLoadingWx(true)
      const wx = await fetchWeather(home)
      if (cancelled) return
      setCityId(home.id)
      setCityObj(home)
      setWeather(wx)
      setWeatherMap({ [home.id]: wx })
      const hist = loadChatHistory(home.id)
      setMessages(
        hist?.length
          ? hist
          : [{ id: Date.now(), role: 'assistant', ...welcomeMessage(wx, lang), timestamp: Date.now() }]
      )
      setLoadingWx(false)
      pushRecent(home)
      loadAqi(home)

      for (const id of ['lucknow', 'delhi', 'mumbai', 'varanasi']) {
        if (id === home.id) continue
        fetchWeather(id).then((w) => {
          if (!cancelled) setWeatherMap((m) => ({ ...m, [id]: w }))
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!weather) return
    const tick = () => setMinsAgo(Math.max(1, Math.round((Date.now() - weather.fetchedAt) / 60000)))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [weather])

  useEffect(() => {
    if (cityId && messages.length) saveChatHistory(cityId, messages)
  }, [messages, cityId])

  useEffect(() => {
    if (weather && messages.length === 1 && messages[0].role === 'assistant') {
      setMessages([{ id: Date.now(), role: 'assistant', ...welcomeMessage(weather, lang), timestamp: Date.now() }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const openMode = (panel) => {
    setModePanel(panel)
    setTab('modes')
  }

  const openMore = (panel) => {
    setMorePanel(panel)
    setTab('more')
  }

  const onSelectCity = async (idOrCity) => {
    const resolved =
      typeof idOrCity === 'object' && idOrCity?.lat ? idOrCity : getCity(idOrCity) || CITIES[idOrCity]
    if (!resolved) return
    if (resolved.id === cityId && weather) {
      setTab('home')
      return
    }
    setTab('home')
    await loadCity(resolved, { resetChat: true })
  }

  const fetchWeatherFor = useCallback(
    async (idOrCity) => {
      let resolved =
        typeof idOrCity === 'object' && idOrCity?.lat != null
          ? registerCity(idOrCity)
          : getCity(idOrCity) || CITIES[idOrCity]
      // Dynamic geocoded places (Tokyo etc.) may only exist after registerCity
      if (!resolved && typeof idOrCity === 'object' && idOrCity?.lat != null) {
        resolved = registerCity({ ...idOrCity, dynamic: true })
      }
      if (!resolved) throw new Error('Unknown city')
      const wx = await fetchWeather(resolved)
      setWeatherMap((m) => ({ ...m, [resolved.id]: wx }))
      try {
        pushRecent(resolved)
      } catch {
        /* optional */
      }
      return wx
    },
    [pushRecent]
  )

  const onSend = async (text) => {
    const raw = (text || '').trim()
    if (/^(open alerts|अलर्ट खोलो)$/i.test(raw)) {
      setTab('alerts')
      return
    }
    if (/^(advice for farmers|किसानों के लिए सलाह|farm mode)$/i.test(raw)) {
      openMode('farm')
      return
    }
    if (/^(travel mode|open travel|यात्रा मोड)$/i.test(raw)) {
      openMode('travel')
      return
    }
    if (/^(school mode|open school|स्कूल मोड)$/i.test(raw)) {
      openMode('school')
      return
    }

    const userMsg = { id: Date.now(), role: 'user', text: raw, timestamp: Date.now() }
    setMessages((m) => [...m, userMsg])
    setChatLoading(true)

    try {
      /** Timed POST to /api/chat — never hang forever on Vercel 504 */
      const postChatApi = async (payload, ms = 22000) => {
        const ac = new AbortController()
        const t = setTimeout(() => ac.abort(), ms)
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
            signal: ac.signal,
          })
          const textBody = await res.text()
          if (textBody.trimStart().startsWith('<')) {
            return { ok: false, error: 'HTML from /api/chat (SPA fallback — api missing)' }
          }
          let j
          try {
            j = JSON.parse(textBody)
          } catch {
            return { ok: false, error: 'Bad JSON from /api/chat', status: res.status }
          }
          // Vercel 504 body: { error: { code: "504", message: "..." } }
          if (!res.ok) {
            const errMsg =
              (typeof j.error === 'string' && j.error) ||
              j.error?.message ||
              j.message ||
              `HTTP ${res.status}`
            return { ok: false, error: errMsg, status: res.status, raw: j }
          }
          return j
        } catch (e) {
          const msg =
            e?.name === 'AbortError' ? `timeout ${ms}ms` : e?.message || String(e)
          return { ok: false, error: msg }
        } finally {
          clearTimeout(t)
        }
      }

      // ── 1) CLASSIFY before any geocode / weather / recent ──
      const classified = classifyUserQuery(raw, cropContext)
      const cropRoute = isCropRoute(classified)

      let targetCity = city
      let targetWx = weather
      let placeResolved = false

      // ── 2) LOCATION RESOLUTION (never pass crop name) ──
      if (cropRoute) {
        // Crop-only: stay on current city — DO NOT geocode raw query
        // Crop+location: resolve ONLY classified.locationQuery (e.g. Kanpur)
        if (classified.locationQuery) {
          try {
            const mentioned = await resolveMentionedCity(raw, null)
            if (
              mentioned?.lat != null &&
              mentioned?.lon != null &&
              !detectCrop(mentioned.name || '') &&
              !isCropQuestion(mentioned.name || '')
            ) {
              const sameHome = mentioned.id && city?.id && mentioned.id === city.id
              const sameCoords =
                city &&
                Math.abs(mentioned.lat - city.lat) < 0.05 &&
                Math.abs(mentioned.lon - city.lon) < 0.05
              if (!sameHome && !sameCoords) {
                targetCity = mentioned
                placeResolved = true
                if (fetchWeatherFor) {
                  try {
                    targetWx = await fetchWeatherFor(mentioned)
                  } catch {
                    targetWx = weather
                  }
                }
              }
            }
          } catch (err) {
            console.warn('crop+place resolve failed', err)
          }
        }
        // else: crop-only → targetCity stays current location (Kanpur etc.)
      } else {
        // Normal weather / place flow — existing behaviour
        try {
          const mentioned = await resolveMentionedCity(raw, null)
          if (mentioned?.lat != null && mentioned?.lon != null) {
            // Guard: never accept a "place" that is actually a crop
            if (detectCrop(mentioned.name || '') || isCropQuestion(mentioned.name || '')) {
              /* ignore bogus crop-as-city */
            } else {
              const sameHome = mentioned.id && city?.id && mentioned.id === city.id
              const sameCoords =
                city &&
                Math.abs(mentioned.lat - city.lat) < 0.05 &&
                Math.abs(mentioned.lon - city.lon) < 0.05
              if (!sameHome && !sameCoords) {
                targetCity = mentioned
                placeResolved = true
                if (fetchWeatherFor) {
                  try {
                    targetWx = await fetchWeatherFor(mentioned)
                  } catch (err) {
                    console.warn('fetchWeatherFor failed', err)
                    targetWx = null
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('place resolve failed', err)
        }
      }

      let result = null

      // ── 3) CROP ROUTE: never geocode crop as place. Prefer Gemini phrasing
      //    grounded on CURRENT city weather + crop hint; else client Crop Intelligence.
      if (cropRoute) {
        const cropId = classified.crop?.id || classified.crop?.name_en
        const placeForCrop = targetCity || city
        if (placeForCrop?.lat != null && placeForCrop?.lon != null) {
          try {
            const j = await postChatApi({
              message: raw,
              lat: placeForCrop.lat,
              lon: placeForCrop.lon,
              name: placeForCrop.name || city?.name || 'Area',
              lang,
              crop: cropId || undefined,
            })
            if (j.ok && j.answer) {
              const placeName = j.place?.name || placeForCrop.name
              const isLlm =
                j.mode === 'llm_grounded' ||
                /gemini|groq|openrouter|openai|llama|qwen|gemma/i.test(String(j.provider || ''))
              if (isLlm && !detectCrop(placeName || '')) {
                result = {
                  text: j.answer,
                  type: 'crop',
                  cropId: cropId || null,
                  confidence: 0.9,
                  cityId: placeForCrop.id || city?.id,
                  source: `${
                    /^groq/i.test(String(j.provider || ''))
                      ? 'Groq'
                      : /^openrouter/i.test(String(j.provider || ''))
                        ? 'OpenRouter'
                        : /gemini/i.test(String(j.provider || ''))
                          ? 'Google Gemini'
                          : 'AI'
                  }+tools · ${j.provider || 'llm'} · ${placeName}`,
                  mode: j.mode || 'llm_grounded',
                  provider: j.provider,
                  citations: j.citations,
                }
              } else if (
                j.mode === 'deterministic_grounded' &&
                !detectCrop(placeName || '')
              ) {
                result = {
                  text: j.answer,
                  type: 'crop',
                  cropId: cropId || null,
                  confidence: 0.82,
                  cityId: placeForCrop.id || city?.id,
                  source: j.llmError
                    ? `Rules+tools · ${placeName} (Gemini: ${String(j.llmError).slice(0, 80)})`
                    : `Grounded rules+tools · ${placeName}`,
                  mode: j.mode,
                  provider: j.provider,
                }
              }
            } else if (j.error) {
              console.warn('crop /api/chat', j.error, j.status)
            }
          } catch (err) {
            console.warn('crop /api/chat failed', err)
          }
        }

        if (!result) {
          result = await chat(raw, {
            weather: targetWx || weather,
            lang,
            fetchWeatherFor,
            cropContext,
            classified,
          })
          // Hard guarantee: type crop when classifier says crop
          if (result && result.type !== 'crop' && classified.crop) {
            result = await chat(classified.crop.name_en || classified.crop.id, {
              weather: targetWx || weather,
              lang,
              fetchWeatherFor,
              cropContext,
              classified,
            })
          }
          // Label client template so it is never confused with Gemini
          if (result && result.type === 'crop') {
            result.source =
              (lang === 'hi'
                ? 'क्लाइंट नियम + Open-Meteo (/api/chat fail ya timeout)'
                : 'Client rules + Open-Meteo (/api/chat failed or timed out)')
          }
        }
        if (result?.type === 'crop' && (result.cropId || cropId)) {
          setCropContext({
            cropId: result.cropId || cropId,
            cityId: result.cityId || targetCity?.id || city?.id,
          })
        }
        // NEVER push recent for crop routes
      } else {
        // ── 4) NORMAL weather: try Gemini-backed /api/chat first (tool-grounded),
        //    then fall back to client deterministic brain.
        {
          try {
            // Final guard: never send crop name as place name to API
            const apiName = detectCrop(targetCity?.name || '')
              ? city?.name || 'Area'
              : targetCity?.name || city?.name || 'Area'
            const j = await postChatApi({
              message: raw,
              lat: targetCity?.lat ?? city?.lat,
              lon: targetCity?.lon ?? city?.lon,
              name: apiName,
              lang,
            })
            if (j.ok && j.answer) {
              const placeName = j.place?.name || apiName
              const route = j.route || (j.mode === 'llm_general' ? 'general' : 'weather')
              // General knowledge answers have no crop-as-city risk
              if (route === 'general' || !detectCrop(placeName || '')) {
                const prov = String(j.provider || '')
                const brand = /^groq/i.test(prov)
                  ? 'Groq'
                  : /^openrouter/i.test(prov)
                    ? 'OpenRouter'
                    : /gemini/i.test(prov)
                      ? 'Google Gemini'
                      : /^openai/i.test(prov)
                        ? 'OpenAI'
                        : 'AI'
                let source
                if (j.mode === 'llm_general' || (route === 'general' && j.mode?.startsWith?.('llm'))) {
                  source = `${brand} · general · ${prov || brand}`
                } else if (j.mode === 'llm_grounded') {
                  source = `${brand}+tools · ${prov} · ${placeName}`
                } else if (j.llmError) {
                  source = /quota|QUOTA|exceeded your current/i.test(String(j.llmError || ''))
                    ? `Open-Meteo free · live tools (AI quota full — add GROQ_API_KEY / OPENROUTER_API_KEY)`
                    : `Rules+tools · ${placeName || '—'} (AI: ${String(j.llmError).slice(0, 70)})`
                } else if (route === 'general') {
                  source = `General rules · (no AI key)`
                } else {
                  source = `Grounded rules+tools · ${placeName}`
                }
                result = {
                  text: j.answer,
                  type:
                    j.mode === 'llm_general'
                      ? 'general'
                      : j.mode === 'llm_grounded'
                        ? 'llm'
                        : 'general',
                  confidence: j.mode === 'llm_grounded' || j.mode === 'llm_general' ? 0.9 : 0.85,
                  cityId: route === 'general' ? undefined : targetCity.id,
                  source,
                  mode: j.mode,
                  provider: j.provider,
                  route,
                  citations: j.citations,
                  llmError: j.llmError,
                }
              }
            } else if (j.error) {
              console.warn('weather /api/chat', j.error, j.status)
            }
          } catch (err) {
            console.warn('weather /api/chat failed', err)
          }
        }

        if (!result) {
          await new Promise((r) => setTimeout(r, 80 + Math.random() * 80))
          result = await chat(raw, {
            weather: targetWx || weather,
            lang,
            fetchWeatherFor,
            cropContext,
            classified,
          })
          if (result) {
            result.source =
              (result.source || '') +
              (lang === 'hi'
                ? ' · क्लाइंट fallback (/api/chat fail ya 504 — api/chat.js redeploy karo)'
                : ' · client fallback (/api/chat failed or 504 timeout — redeploy api/chat.js)')
          }
          if (!result.cityId && targetCity?.id) result.cityId = targetCity.id
          if (
            placeResolved &&
            targetCity &&
            result.cityId &&
            city?.id &&
            result.cityId === city.id &&
            targetCity.id !== city.id
          ) {
            result.text =
              (lang === 'hi'
                ? `⚠️ **${targetCity.name}** का डेटा लोड नहीं हुआ — नीचे घर शहर (**${city.name}**) का जवाब है।\n\n`
                : `⚠️ Could not lock **${targetCity.name}** weather — showing home city (**${city.name}**) below.\n\n`) +
              result.text
          }
        }

        if (
          placeResolved &&
          targetCity?.name &&
          result.source &&
          !String(result.source).includes(targetCity.name)
        ) {
          result.source = `${result.source} · ${targetCity.name}`
        }

        // ── 5) Recent locations: ONLY validated geographic cities (never crops) ──
        if (
          result.cityId &&
          result.cityId !== cityId &&
          result.type !== 'crop' &&
          !result.cropId &&
          !cropRoute
        ) {
          const other = getCity(result.cityId) || targetCity
          if (
            other &&
            !detectCrop(other.name || '') &&
            !isCropQuestion(other.name || '') &&
            !isBogusCropCity(other)
          ) {
            pushRecent(other)
          }
        }
      }

      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: 'assistant', ...result, timestamp: Date.now() },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: lang === 'hi' ? 'क्षमा करें, कुछ गड़बड़ हुई।' : 'Sorry, something went wrong.',
          type: 'general',
          timestamp: Date.now(),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const askFromDashboard = (q) => {
    setTab('chat')
    setTimeout(() => onSend(q), 100)
  }

  const alertMonitor = useAlertMonitor({
    enabled: !!prefs.notifyAlerts,
    lang,
    homeCityId: prefs.homeCityId || cityId || 'kanpur',
    focusCity: city,
    minSeverity: prefs.notifyMinSeverity || 'yellow',
  })

  const onSimulate = () => {
    if (!weather) return
    const next = injectSimulatedAlert(weather)
    setWeather(next)
    setWeatherMap((m) => ({ ...m, [cityId]: next }))
    const a = next.alerts[0]
    setMessages((m) => [
      ...m,
      {
        id: Date.now(),
=======
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
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0
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
<<<<<<< HEAD
    dbLogAlert({
      id: a.id,
      cityId,
      severity: a.severity,
      title: a.title,
      source: 'simulate',
      kind: 'simulate',
    }).catch(() => {})
    setTab('alerts')
=======
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0
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
<<<<<<< HEAD
    <div className="mesh-bg h-full w-full">
      {/* Living ambient sky — CSS orbs, GPU-only, reduced-motion safe */}
      <div className="ambient-sky" aria-hidden>
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
        <span className="orb orb-d" />
        <span className="veil" />
        <span className="shine" />
      </div>

      {showOnboard && (
        <Suspense fallback={<TabFallback />}>
          <Onboarding
            lang={lang}
            onDone={() => {
              setOnboarded()
              setShowOnboard(false)
            }}
          />
        </Suspense>
      )}

      {/* Command-center shell: icon rail + glass main (reference-style) */}
      <div className="app-shell h-full w-full">
        {/* Desktop icon rail */}
        <aside className="app-sidebar hidden lg:flex" title={tr(lang, 'appName')}>
          <div className="pt-5 pb-3 flex justify-center border-b border-white/8">
            <div className="w-11 h-11 rounded-2xl glass-sky flex items-center justify-center shadow-lg shadow-sky-400/10">
              <CloudSun className="w-5 h-5 text-sun-300 relative z-[1]" />
            </div>
          </div>

          <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto scroll-thin scroll-dark flex flex-col items-center">
            {SIDEBAR_NAV.map((item) => {
              const Icon = item.icon
              const active = sidebarActive(item)
              const badge = item.id === 'alerts' ? badgeCount : 0
              const label = lang === 'hi' ? item.hi : item.en
              return (
                <button
                  key={item.id}
                  type="button"
                  title={label}
                  onClick={() => goSidebar(item)}
                  className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition focus-ring ${
                    active
                      ? 'bg-white/14 text-white shadow-lg shadow-black/20'
                      : 'text-white/45 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-alert-red text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="px-2 pb-4 pt-2 border-t border-white/8 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={openCities}
              title={displayName}
              className="w-12 h-12 rounded-2xl bg-white/6 hover:bg-white/10 border border-white/8 flex items-center justify-center focus-ring"
            >
              <MapPin className="w-4 h-4 text-sky-300" />
            </button>
            <button
              type="button"
              onClick={refreshLive}
              disabled={loadingWx}
              title={lang === 'hi' ? 'रीफ्रेश' : 'Refresh'}
              className="w-10 h-10 rounded-xl text-white/50 hover:text-white hover:bg-white/8 flex items-center justify-center disabled:opacity-40 focus-ring"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingWx ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => updatePrefs({ ...prefs, lang: lang === 'en' ? 'hi' : 'en' })}
              title="Language"
              className="w-10 h-10 rounded-xl text-[11px] font-bold text-white/55 hover:text-white hover:bg-white/8 focus-ring"
            >
              {lang === 'en' ? 'हि' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              title="About"
              className="w-10 h-10 rounded-xl text-white/45 hover:text-white hover:bg-white/8 flex items-center justify-center focus-ring"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="app-main-col flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {/* Mobile home chrome */}
          {isHome && (
            <header className="lg:hidden shrink-0 mobile-home-chrome px-3.5 pt-3 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-[14px] glass-sky flex items-center justify-center shadow-sm shadow-black/20">
                    <CloudSun className="w-4 h-4 text-sun-300 relative z-[1]" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-[15px] font-semibold tracking-tight leading-none text-white drop-shadow-sm">
                      {tr(lang, 'appName')}
                    </h1>
                    <p className="text-[10px] text-white/60 mt-0.5 truncate font-medium flex items-center gap-1.5">
                      {weather?.live ? (
                        <>
                          <span className="live-dot" /> LIVE
                        </>
                      ) : (
                        <>
                          <span className="live-dot-off" /> OFFLINE
                        </>
                      )}
                      <span className="text-white/40">· {minsAgo}m</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={refreshLive}
                    disabled={loadingWx}
                    className="w-9 h-9 rounded-full glass-sky text-white flex items-center justify-center pressable disabled:opacity-50 focus-ring"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 relative z-[1] ${loadingWx ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePrefs({ ...prefs, lang: lang === 'en' ? 'hi' : 'en' })}
                    className="h-9 px-3 rounded-full glass-sky text-white text-[11px] font-semibold flex items-center gap-1 pressable focus-ring"
                  >
                    <Languages className="w-3 h-3 relative z-[1]" />
                    <span className="relative z-[1]">{lang === 'en' ? 'हि' : 'EN'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAbout(true)}
                    className="w-9 h-9 rounded-full glass-sky text-white flex items-center justify-center pressable focus-ring"
                  >
                    <Info className="w-3.5 h-3.5 relative z-[1]" />
                  </button>
                </div>
              </div>
            </header>
          )}

          {/* Mobile non-home header */}
          {!isHome && (
            <header className="lg:hidden shrink-0 bg-gradient-to-b from-navy-900 to-navy-800 text-white px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                    <CloudSun className="w-5 h-5 text-sun-400" />
                  </div>
                  <div>
                    <h1 className="text-[15px] font-semibold tracking-tight leading-none">{tr(lang, 'appName')}</h1>
                    <p className="text-[10px] text-white/50 mt-0.5">{tr(lang, 'tagline')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={refreshLive}
                    disabled={loadingWx}
                    title={lang === 'hi' ? 'रीफ्रेश' : 'Refresh'}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition disabled:opacity-50 focus-ring"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingWx ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePrefs({ ...prefs, lang: lang === 'en' ? 'hi' : 'en' })}
                    className="flex items-center gap-1 text-[11px] font-semibold bg-white/10 hover:bg-white/15 px-2.5 py-1.5 rounded-full transition focus-ring"
                  >
                    <Languages className="w-3 h-3" />
                    {lang === 'en' ? 'भाषा' : 'EN'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAbout(true)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition focus-ring"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={openCities}
                className="w-full flex items-center gap-3 bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl px-3 py-2.5 transition text-left focus-ring"
              >
                {loadingWx || !weather ? (
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 shimmer rounded" />
                    <div className="h-3 w-48 shimmer rounded" />
                  </div>
                ) : (
                  <>
                    <WeatherIcon name={weather.current.icon} className="w-10 h-10 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[22px] font-semibold leading-none">
                          {displayTemp}
                          <span className="text-[13px] font-normal text-white/60">{unitLbl}</span>
                        </span>
                        <span className="text-[13px] text-white/80 truncate">{displayName}</span>
                        <span className="text-white/40 text-[12px]">▼</span>
                      </div>
                      <p className="text-[11px] text-white/55 mt-0.5 truncate">
                        {headerCondition}
                        {' · '}
                        {toDisplayTemp(weather.daily[0].min, units)}–{toDisplayTemp(weather.daily[0].max, units)}°
                        {aqi?.aqi != null && <span className="ml-1.5 text-white/70">AQI {aqi.aqi}</span>}
                        {topAlert && prefs.notifyAlerts && (
                          <span className="ml-1.5 inline-flex items-center gap-1">
                            <SeverityDot severity={topAlert.severity} />
                            <span className="text-alert-amber font-medium uppercase">{topAlert.severity}</span>
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          refreshLive()
                        }}
                        className={`flex items-center gap-1 justify-end text-[10px] ${
                          weather.live ? 'text-mint-300' : 'text-alert-amber'
                        }`}
                        title={weather.liveSource || ''}
                      >
                        <Radio className="w-3 h-3" />
                        {weather.live ? 'LIVE' : 'OFFLINE · tap'}
                      </button>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        {tr(lang, 'updated')} {minsAgo} {tr(lang, 'minAgo')}
                      </p>
                    </div>
                  </>
                )}
              </button>
            </header>
          )}

          {/* Desktop top strip — unified glass chrome for all tabs */}
          <header className="hidden lg:flex shrink-0 px-6 py-3.5 items-center justify-between gap-4 bg-white/[0.03] border-b border-white/[0.07] backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
                {isHome
                  ? lang === 'hi'
                    ? 'मौसम इंटेलिजेंस'
                    : 'Weather intelligence'
                  : sectionTitle}
              </p>
              <p className="text-[14px] font-semibold text-white truncate mt-0.5">
                {isHome || tab !== 'chat' ? (
                  <>
                    {displayName}
                    {weather && tab !== 'home' && (
                      <span className="text-white/50 font-medium">
                        {' · '}
                        {displayTemp}
                        {unitLbl}
                        {headerCondition ? ` · ${headerCondition}` : ''}
                      </span>
                    )}
                  </>
                ) : lang === 'hi' ? (
                  'सवाल पूछें — किसी भी शहर का नाम लिखें'
                ) : (
                  'Ask anything — name any city worldwide'
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-[12px] text-white/70">
              {weather && tab !== 'chat' && tab !== 'home' && (
                <WeatherIcon name={weather.current.icon} className="w-8 h-8" />
              )}
              {topAlert && prefs.notifyAlerts && tab !== 'home' && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-alert-amber">
                  <SeverityDot severity={topAlert.severity} />
                  {topAlert.severity.toUpperCase()}
                </span>
              )}
              {weather?.live ? (
                <span className="inline-flex items-center gap-1.5 text-mint-300 font-semibold">
                  <span className="live-dot" /> LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-alert-amber font-semibold">
                  <span className="live-dot-off" /> OFFLINE
                </span>
              )}
              {isHome && (
                <span className="text-white/45">
                  {tr(lang, 'updated')} {minsAgo} {tr(lang, 'minAgo')}
                </span>
              )}
            </div>
          </header>

          <main className="flex-1 min-h-0 relative flex flex-col bg-transparent">
            {/* Fast tab switch: no exit animation (cheaper paint on low-end phones) */}
            <div
              key={tab + (tab === 'modes' ? modePanel : '') + (tab === 'more' ? morePanel : '')}
              className="flex-1 min-h-0 flex flex-col animate-bubble"
            >
                {tab === 'home' && (
                  <DashboardTab
                    lang={lang}
                    weather={weather}
                    aqi={aqi}
                    units={units}
                    minsAgo={minsAgo}
                    onOpenMode={openMode}
                    onOpenChat={askFromDashboard}
                    onOpenAlerts={() => setTab('alerts')}
                    onOpenCities={openCities}
                    onOpenForecast={openForecast}
                    recentCities={recentCities}
                    onSelectCity={onSelectCity}
                  />
                )}
                {tab === 'chat' && (
                  <Suspense fallback={<TabFallback />}>
                    <ChatTab
                      lang={lang}
                      messages={messages}
                      onSend={onSend}
                      loading={chatLoading}
                      weather={weather}
                      demoQueries={tr(lang, 'demoQueries')}
                    />
                  </Suspense>
                )}
                {tab === 'alerts' && (
                  <Suspense fallback={<TabFallback />}>
                    <AlertsTab
                      lang={lang}
                      weather={weather}
                      onSimulate={onSimulate}
                      nearbyFeed={alertMonitor.feed}
                      monitor={alertMonitor}
                      notifyEnabled={!!prefs.notifyAlerts}
                      onToggleNotify={(v) => updatePrefs({ ...prefs, notifyAlerts: v })}
                    />
                  </Suspense>
                )}
                {tab === 'modes' && (
                  <div className="flex flex-col h-full min-h-0">
                    <div className="shrink-0 px-3 pt-3 pb-2 lg:px-5">
                      <div className="flex gap-1 p-1 bg-white/6 rounded-xl border border-white/10 max-w-md backdrop-blur-md">
                        {MODE_PANELS.map((p) => {
                          const Icon = p.icon
                          const active = modePanel === p.id
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setModePanel(p.id)}
                              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-semibold transition focus-ring ${
                                active
                                  ? 'bg-sky-400/25 text-white shadow-sm border border-white/15'
                                  : 'text-white/50 hover:text-white'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {lang === 'hi' ? p.labelHi : p.labelEn}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <Suspense fallback={<TabFallback />}>
                        {modePanel === 'farm' && <FarmTab lang={lang} weather={weather} />}
                        {modePanel === 'travel' && <TravelTab lang={lang} weather={weather} aqi={aqi} />}
                        {modePanel === 'school' && <SchoolTab lang={lang} weather={weather} aqi={aqi} />}
                      </Suspense>
                    </div>
                  </div>
                )}
                {tab === 'more' && (
                  <div className="flex flex-col h-full min-h-0">
                    <div className="shrink-0 px-3 pt-3 pb-2 lg:hidden">
                      <div className="flex gap-1 p-1 bg-white/6 rounded-xl border border-white/10 backdrop-blur-md">
                        {MORE_PANELS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setMorePanel(p.id)}
                            className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition focus-ring ${
                              morePanel === p.id
                                ? 'bg-sky-400/25 text-white shadow-sm border border-white/15'
                                : 'text-white/50 hover:text-white'
                            }`}
                          >
                            {lang === 'hi' ? p.hi : p.en}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <Suspense fallback={<TabFallback />}>
                      {morePanel === 'forecast' && <ForecastTab lang={lang} weather={weather} />}
                      {morePanel === 'climate' && (
                        <ClimateTab lang={lang} city={city} weather={weather} />
                      )}
                      {morePanel === 'locations' && (
                        <CitiesTab
                          lang={lang}
                          cityId={cityId}
                          onSelect={onSelectCity}
                          weatherMap={weatherMap}
                          recentCities={recentCities}
                        />
                      )}
                      {morePanel === 'settings' && (
                        <SettingsTab
                          lang={lang}
                          prefs={prefs}
                          onChangePrefs={(p) => {
                            updatePrefs(p)
                          }}
                          onResetOnboarding={() => {
                            try {
                              localStorage.removeItem('wgpt_onboarded_v1')
                            } catch {
                              /* */
                            }
                            setShowOnboard(true)
                          }}
                          cityId={cityId}
                          monitor={alertMonitor}
                        />
                      )}
                      </Suspense>
                    </div>
                  </div>
                )}
            </div>
          </main>

          {/* Mobile bottom nav — liquid glass */}
          <nav className="lg:hidden shrink-0 px-2 pt-1.5 pb-safe nav-glass" aria-label="Main">
            <div className="flex items-stretch justify-around">
              {TABS.map((tItem) => {
                const Icon = tItem.icon
                const active = tab === tItem.id
                const badge = tItem.id === 'alerts' ? badgeCount : 0
                return (
                  <button
                    key={tItem.id}
                    type="button"
                    onClick={() => setTab(tItem.id)}
                    className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl transition pressable focus-ring ${
                      active ? 'text-white' : 'text-white/45 hover:text-white/75'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-x-3 inset-y-1 rounded-2xl nav-pill-liquid"
                        transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.7 }}
                      />
                    )}
                    <span className="relative z-[1]">
                      <Icon className={`w-[19px] h-[19px] ${active ? 'stroke-[2.35px]' : 'stroke-[1.75px]'}`} />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 bg-alert-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                          {badge}
                        </span>
                      )}
                    </span>
                    <span className={`relative z-[1] text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>
                      {navLabel(tItem.id)}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        </div>
      </div>

      {toast && (
        <div className="toast-host" role="status" aria-live="polite">
          <div className={`toast ${toast.kind === 'err' ? 'toast-err' : ''}`}>{toast.msg}</div>
        </div>
      )}

      {showAbout && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/70 backdrop-blur-md p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="dash-glass max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-bubble"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-navy-900/80 backdrop-blur-md border-b border-white/10 px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-semibold text-white">WeatherGPT · Product</h2>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="p-1 rounded-lg hover:bg-white/10 focus-ring text-white/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-[13px] text-white/70 leading-relaxed">
              <p className="text-[14px] text-white font-medium">
                AI weather intelligence for decisions — what is happening, why it matters, and what to do next.
                Grounded on live Open-Meteo, AQI, GDACS and flood feeds.
              </p>
              <Section title="Product layers">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Live weather + AQI + structured AI brief</li>
                  <li>NL chat (HI/EN) + voice STT/TTS</li>
                  <li>NWP multi-model (GFS/ECMWF/ICON) + climate history</li>
                  <li>Multi-source alerts + push monitor</li>
                  <li>Farm / Travel / School decision support</li>
                  <li>Public Open API for external AI evaluators</li>
                </ul>
              </Section>
              <Section title="Stack">
                <p>
                  React + Vite + PWA · Vercel serverless · Open-Meteo (forecast, archive, AQI, flood, multi-model) ·
                  GDACS · grounded NLU
                </p>
              </Section>
              <Section title={lang === 'hi' ? 'बाहरी AI / जज टेस्ट' : 'External AI / judge test'}>
                <ul className="list-disc pl-4 space-y-1 text-[12px]">
                  <li>
                    <a className="text-sky-300 font-semibold" href="/api/public" target="_blank" rel="noreferrer">
                      /api/public
                    </a>{' '}
                    — discovery JSON
                  </li>
                  <li>
                    <a className="text-sky-300 font-semibold" href="/HONESTY.txt" target="_blank" rel="noreferrer">
                      /HONESTY.txt
                    </a>{' '}
                    ·{' '}
                    <a
                      className="text-sky-300 font-semibold"
                      href="/IMPACT_AND_SCALE.txt"
                      target="_blank"
                      rel="noreferrer"
                    >
                      /IMPACT_AND_SCALE.txt
                    </a>
                  </li>
                  <li>
                    <a className="text-sky-300 font-semibold" href="/llms.txt" target="_blank" rel="noreferrer">
                      /llms.txt
                    </a>{' '}
                    ·{' '}
                    <a className="text-sky-300 font-semibold" href="/sih.html" target="_blank" rel="noreferrer">
                      /sih.html
                    </a>{' '}
                    ·{' '}
                    <a className="text-sky-300 font-semibold" href="/openapi.json" target="_blank" rel="noreferrer">
                      /openapi.json
                    </a>
                  </li>
                </ul>
                <p className="text-[11px] text-white/45 mt-2">
                  {lang === 'hi'
                    ? 'Default AI = grounded rules+tools. LLM तभी जब सर्वर पर API key हो। Marathi नहीं। DB/Supabase live claim मत करना।'
                    : 'Default AI = grounded rules+tools. LLM only if server API key set. No Marathi. Do not claim live Supabase/DB.'}
                </p>
              </Section>
              <p className="text-[11px] text-white/40 text-center">
                SIH build · {CITY_LIST.length}+ cities · college internal round cleared
              </p>
              <p className="text-[11px] text-center mt-2">
                <a href="?preview=1" className="text-sky-400 font-semibold hover:underline">
                  {lang === 'hi' ? 'डेवइस लैब (M/T/D)' : 'Device lab (M/T/D)'}
                </a>
                <span className="text-white/40"> · optional</span>
              </p>
            </div>
          </div>
        </div>
=======
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
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0
      )}
    </div>
  )
}
<<<<<<< HEAD

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">{title}</h3>
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-white/75">{children}</div>
    </div>
  )
}
=======
>>>>>>> 3d189f758e64ccecbda909180e8a542f0d2fa3a0
