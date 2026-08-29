import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
import { CITIES, CITY_LIST, getCity, registerCity } from './data/cities.js'
import { tr } from './data/i18n.js'
import { fetchWeather, injectSimulatedAlert, clearCache } from './services/weather.js'
import {
  chat,
  welcomeMessage,
  resolveMentionedCity,
  isCropQuestion,
  detectCrop,
  classifyUserQuery,
  isCropRoute,
  isCropOnlyClassification,
} from './services/ai.js'
import { fetchAQI } from './services/aqi.js'
import {
  loadPrefs,
  savePrefs,
  loadOnboarded,
  setOnboarded,
  loadChatHistory,
  saveChatHistory,
  toDisplayTemp,
  tempUnitLabel,
} from './services/storage.js'
import { dbLogAlert } from './services/db.js'
import { WeatherIcon, SeverityDot } from './components/Icons.jsx'
// Eager: home dashboard (first paint). Rest: code-split for low bandwidth.
import DashboardTab from './components/DashboardTab.jsx'
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
import { useAlertMonitor } from './hooks/useAlertMonitor.js'

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

/** Chat noise / greetings / non-places — never Recent cities */
const RECENT_NOISE = new Set(
  (
    'hi hello hii hlo hola hey yo ok okay thanks thank thx bye byee good morning good night ' +
    'gm gn sup lol lmao haha hmm hmmm yes no yeah yep nope nah please pls bro dude sir madam ' +
    'help test abc xyz qwerty asdf what why how when where who whom which the a an is are was ' +
    'were am be been being do does did done will would could should may might must can ' +
    'weather rain temp forecast mausam baarish irrigation crop wheat rice farm kheti ' +
    'namaste namaskar shukriya dhanyavad theek thik sahi galat kya kaise kab kahan kaun'
  )
    .split(/\s+/)
    .filter(Boolean),
)

function isNoisePlaceQuery(q) {
  const t = String(q || '')
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
  if (!t) return true
  if (RECENT_NOISE.has(t)) return true
  // very short freestyle typos (hlo, hii, okk)
  if (t.length <= 3 && !/^(goa|pune|agra|noida|kochi|surat|indore|patna|ranchi|udaipur|mysore|nashik)$/i.test(t))
    return true
  // pure chat / emoji-ish
  if (/^(ha+|hmm+|ok+|y+o+|h+i+|hlo+|he+y+|sup+)$/i.test(t)) return true
  return false
}

/**
 * Recent cities: ONLY real geographic places.
 * Reject crops, greetings, tiny village fuzzy matches from chat noise.
 */
function isBogusCropCity(c) {
  if (!c) return true
  const name = String(c.name || '').trim()
  const id = String(c.id || '')
  if (!name) return true
  if (detectCrop(name) || detectCrop(id) || isCropQuestion(name)) return true
  const first = name.split(/\s+/)[0]
  if (detectCrop(first) && (c.population || 0) < 80000) return true
  if (isNoisePlaceQuery(name) || isNoisePlaceQuery(id)) return true
  return false
}

/** True = safe to show in Recent / Suggested cities rail */
function isValidRecentCity(c, { explicitPlace = false } = {}) {
  if (!c || c.lat == null || c.lon == null) return false
  if (isBogusCropCity(c)) return false
  const name = String(c.name || '').trim()
  if (name.length < 2) return false
  if (isNoisePlaceQuery(name)) return false

  const pop = Number(c.population) || 0
  const cc = String(c.countryCode || c.countryShort || '').toUpperCase()
  // Curated / registered app cities always OK
  if (c.id && getCity(c.id) && getCity(c.id).name) {
    const g = getCity(c.id)
    if (g && !isBogusCropCity(g)) return true
  }
  // Explicit user place (Tokyo weather, in Pune) — allow decent geocode hits
  if (explicitPlace) {
    // Still block tiny obscure matches under 5k unless country capital-ish
    if (pop > 0 && pop < 5000) return false
    return true
  }
  // Auto-from-chat: require real town (pop) or known IN metro list feel
  if (pop >= 25000) return true
  if (pop >= 8000 && cc === 'IN') return true
  // No population data: only if name looks like multi-word place or long unique name
  if (pop === 0 && name.split(/\s+/).length >= 2 && name.length >= 6) return true
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
      .filter((c) => c && isValidRecentCity(c, { explicitPlace: true }))
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
    const clean = (list || []).filter((c) => c && isValidRecentCity(c, { explicitPlace: true })).slice(0, 12)
    localStorage.setItem('weathergpt_recent_cities', JSON.stringify(clean))
  } catch {
    /* ignore */
  }
}

export default function App() {
  const prefersReducedMotion = useReducedMotion()
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

  const city = cityObj || getCity(cityId) || CITIES.kanpur
  const units = prefs.units || 'C'

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
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t && ['home', 'chat', 'alerts', 'modes', 'more'].includes(t)) setTab(t)
    } catch {
      /* */
    }
  }, [])

  const updatePrefs = useCallback((next) => {
    setPrefs(next)
    savePrefs(next)
  }, [])

  const pushRecent = useCallback((c, opts = {}) => {
    if (!c?.id && !(c?.lat != null && c?.lon != null)) return
    if (!isValidRecentCity(c, opts)) return
    registerCity(c)
    setRecentCities((prev) => {
      const next = [
        c,
        ...prev.filter((x) => x.id !== c.id && isValidRecentCity(x, { explicitPlace: true })),
      ].slice(0, 12)
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

  const refreshLive = useCallback(async () => {
    if (!city) return
    setLoadingWx(true)
    try {
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
          // Greetings / chat noise must NEVER geocode into Recent (e.g. "hlo" → Hlotse)
          if (isNoisePlaceQuery(raw)) {
            /* stay on current city */
          } else {
          const mentioned = await resolveMentionedCity(raw, null)
          if (mentioned?.lat != null && mentioned?.lon != null) {
            // Guard: never accept a "place" that is actually a crop / noise geocode
            if (
              detectCrop(mentioned.name || '') ||
              isCropQuestion(mentioned.name || '') ||
              !isValidRecentCity(mentioned, { explicitPlace: true })
            ) {
              /* ignore bogus crop-as-city or fuzzy junk */
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
          } // end non-noise place resolve
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

        // ── 5) Recent: ONLY when user named a real city/country (never chat noise)
        if (
          placeResolved &&
          targetCity &&
          result.type !== 'crop' &&
          !result.cropId &&
          !cropRoute
        ) {
          const other = getCity(result.cityId) || targetCity
          if (
            other &&
            other.id !== city?.id &&
            isValidRecentCity(other, { explicitPlace: true })
          ) {
            pushRecent(other, { explicitPlace: true })
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
        role: 'assistant',
        type: 'alert',
        alertData: a,
        text:
          lang === 'hi'
            ? `## 🚨 नया RED अलर्ट (डेमो)\n\n### सारांश\n**${a.title_hi}** — ${city.name_hi || city.name}\n\n### अगला कदम\nअभी **Alerts** टैब खोलें।`
            : `## 🚨 NEW RED ALERT (demo)\n\n### Summary\n**${a.title}** for ${city.name}\n\n### Next step\nOpen the **Alerts** tab now.`,
        source: lang === 'hi' ? 'सिमुलेशन' : 'Simulation',
        confidence: 1,
        chips: lang === 'hi' ? ['अलर्ट खोलो', 'यात्रा मोड'] : ['Open alerts', 'Travel mode'],
        timestamp: Date.now(),
      },
    ])
    // Push OS notification if permission granted
    if (prefs.notifyAlerts) {
      alertMonitor.notifyFromWeatherAlerts(
        [{ ...a, place: city.name, notifyKey: `${a.id}::${city.name}` }],
        { force: true }
      )
    }
    dbLogAlert({
      id: a.id,
      cityId,
      severity: a.severity,
      title: a.title,
      source: 'simulate',
      kind: 'simulate',
    }).catch(() => {})
    setTab('alerts')
  }

  // Merge live multi-city feed with current city weather alerts for badge
  const nearbyFeedAlerts = alertMonitor.feed?.alerts || []
  const localAlerts = weather?.alerts || []
  const badgeCount = localAlerts.length || nearbyFeedAlerts.length
  const topAlert = localAlerts[0] || nearbyFeedAlerts[0]
  const headerCondition = useMemo(() => {
    if (!weather) return '…'
    return lang === 'hi' ? weather.current.condition_hi : weather.current.condition
  }, [weather, lang])
  const displayName = lang === 'hi' ? city.name_hi || city.name : city.name
  const displayTemp = weather ? toDisplayTemp(weather.current.temp, units) : '—'
  const unitLbl = tempUnitLabel(units)
  const isHome = tab === 'home'

  const openCities = () => openMore('locations')
  const openForecast = () => openMore('forecast')

  const navLabel = (id) => {
    const map = {
      home: lang === 'hi' ? 'होम' : 'Home',
      chat: tr(lang, 'chat'),
      alerts: tr(lang, 'alerts'),
      modes: lang === 'hi' ? 'मोड' : 'Modes',
      more: lang === 'hi' ? 'और' : 'More',
    }
    return map[id]
  }

  const goSidebar = (item) => {
    if (item.more) {
      openMore(item.more)
      return
    }
    setTab(item.id)
  }

  const sidebarActive = (item) => {
    if (item.more) return tab === 'more' && morePanel === item.more
    return tab === item.id
  }

  const sectionTitle = (() => {
    if (tab === 'chat') return lang === 'hi' ? 'AI सहायक' : 'AI assistant'
    if (tab === 'alerts') return lang === 'hi' ? 'अलर्ट सेंटर' : 'Alert centre'
    if (tab === 'modes') return lang === 'hi' ? 'निर्णय मोड' : 'Decision modes'
    if (tab === 'more') {
      if (morePanel === 'forecast') return lang === 'hi' ? 'पूर्वानुमान' : 'Forecast'
      if (morePanel === 'climate') return lang === 'hi' ? 'जलवायु व NWP' : 'Climate & NWP'
      if (morePanel === 'locations') return lang === 'hi' ? 'शहर' : 'Cities'
      return lang === 'hi' ? 'सेटिंग्स' : 'Settings'
    }
    return tr(lang, 'appName')
  })()

  return (
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
            <header className="mobile-only-chrome mobile-home-chrome px-3.5 pt-3 pb-2">
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
            <header className="mobile-only-chrome bg-gradient-to-b from-navy-900 to-navy-800 text-white px-4 pt-3 pb-3">
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
          <header className="desktop-only-chrome shrink-0 px-6 py-3.5 items-center justify-between gap-4 bg-white/[0.03] border-b border-white/[0.07] backdrop-blur-xl">
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
            {/* A short, spring-like transition makes navigation feel native without blocking input. */}
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={tab + (tab === 'modes' ? modePanel : '') + (tab === 'more' ? morePanel : '')}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6, scale: 0.996 }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 390, damping: 34, mass: 0.75 }}
                className="tab-stage flex-1 min-h-0 flex flex-col"
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
              </motion.div>
            </AnimatePresence>
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
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">{title}</h3>
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-white/75">{children}</div>
    </div>
  )
}
