import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { chat, welcomeMessage } from './services/ai'
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
import { WeatherIcon, SeverityDot } from './components/Icons'
import ChatTab from './components/ChatTab'
import AlertsTab from './components/AlertsTab'
import FarmTab from './components/FarmTab'
import ForecastTab from './components/ForecastTab'
import CitiesTab from './components/CitiesTab'
import TravelTab from './components/TravelTab'
import SchoolTab from './components/SchoolTab'
import DashboardTab from './components/DashboardTab'
import SettingsTab from './components/SettingsTab'
import ClimateTab from './components/ClimateTab'
import Onboarding from './components/Onboarding'
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

function loadRecent() {
  try {
    const raw = localStorage.getItem('weathergpt_recent_cities')
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map((c) => registerCity(c)).filter(Boolean) : []
  } catch {
    return []
  }
}

function saveRecent(list) {
  try {
    localStorage.setItem('weathergpt_recent_cities', JSON.stringify(list.slice(0, 12)))
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
  const [showAbout, setShowAbout] = useState(false)
  const [minsAgo, setMinsAgo] = useState(1)
  const [recentCities, setRecentCities] = useState(() => loadRecent())
  const [showOnboard, setShowOnboard] = useState(() => !loadOnboarded())

  const city = cityObj || getCity(cityId) || CITIES.kanpur
  const units = prefs.units || 'C'

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

  const pushRecent = useCallback((c) => {
    if (!c?.id) return
    registerCity(c)
    setRecentCities((prev) => {
      const next = [c, ...prev.filter((x) => x.id !== c.id)].slice(0, 12)
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
      } finally {
        setLoadingWx(false)
      }
    },
    [lang, pushRecent, loadAqi]
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
    } finally {
      setLoadingWx(false)
    }
  }, [city, loadAqi])

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
      const resolved =
        typeof idOrCity === 'object' && idOrCity?.lat
          ? registerCity(idOrCity)
          : getCity(idOrCity) || CITIES[idOrCity]
      if (!resolved) throw new Error('Unknown city')
      const wx = await fetchWeather(resolved)
      setWeatherMap((m) => ({ ...m, [resolved.id]: wx }))
      pushRecent(resolved)
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
      await new Promise((r) => setTimeout(r, 280 + Math.random() * 280))
      const result = await chat(raw, { weather, lang, fetchWeatherFor })
      if (result.cityId && result.cityId !== cityId) {
        const other = getCity(result.cityId)
        if (other) pushRecent(other)
      }
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'assistant', ...result, timestamp: Date.now() }])
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
      {showOnboard && (
        <Onboarding
          lang={lang}
          onDone={() => {
            setOnboarded()
            setShowOnboard(false)
          }}
        />
      )}

      {/* Single shell: sidebar (desktop) + main column + bottom nav (mobile) */}
      <div className="app-shell h-full w-full max-w-[1440px] mx-auto">
        {/* Desktop sidebar */}
        <aside className="app-sidebar hidden lg:flex">
          <div className="px-4 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <CloudSun className="w-5 h-5 text-sun-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-tight leading-none">{tr(lang, 'appName')}</p>
                <p className="text-[10px] text-white/45 mt-1 truncate">{tr(lang, 'tagline')}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto scroll-thin scroll-dark">
            {SIDEBAR_NAV.map((item) => {
              const Icon = item.icon
              const active = sidebarActive(item)
              const badge = item.id === 'alerts' ? badgeCount : 0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goSidebar(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition focus-ring ${
                    active
                      ? 'bg-white/12 text-white font-semibold'
                      : 'text-white/55 hover:text-white hover:bg-white/6 font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{lang === 'hi' ? item.hi : item.en}</span>
                  {badge > 0 && (
                    <span className="bg-alert-red text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="px-3 pb-4 pt-2 border-t border-white/8 space-y-2">
            <button
              type="button"
              onClick={openCities}
              className="w-full text-left rounded-xl bg-white/6 hover:bg-white/10 border border-white/8 px-3 py-2.5 transition focus-ring"
            >
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                {lang === 'hi' ? 'स्थान' : 'Location'}
              </p>
              <p className="text-[13px] font-semibold text-white mt-0.5 truncate">{displayName}</p>
              <p className="text-[11px] text-white/50 mt-0.5 flex items-center gap-1.5">
                {weather?.live ? (
                  <>
                    <span className="live-dot" /> LIVE
                  </>
                ) : (
                  <>
                    <span className="live-dot-off" /> OFFLINE
                  </>
                )}
                <span>· {minsAgo}m</span>
              </p>
            </button>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={refreshLive}
                disabled={loadingWx}
                className="flex-1 h-9 rounded-lg bg-white/8 hover:bg-white/12 text-white flex items-center justify-center gap-1.5 text-[11px] font-semibold disabled:opacity-50 focus-ring"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingWx ? 'animate-spin' : ''}`} />
                {lang === 'hi' ? 'रीफ्रेश' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => updatePrefs({ ...prefs, lang: lang === 'en' ? 'hi' : 'en' })}
                className="h-9 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white text-[11px] font-semibold flex items-center gap-1 focus-ring"
              >
                <Languages className="w-3.5 h-3.5" />
                {lang === 'en' ? 'हि' : 'EN'}
              </button>
              <button
                type="button"
                onClick={() => setShowAbout(true)}
                className="w-9 h-9 rounded-lg bg-white/8 hover:bg-white/12 text-white flex items-center justify-center focus-ring"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="app-main-col flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {/* Mobile home chrome */}
          {isHome && (
            <header className="lg:hidden shrink-0 relative z-20 px-3.5 pt-3 pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-[14px] glass-sky flex items-center justify-center">
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
                      <span>· {minsAgo}m</span>
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

          {/* Desktop context bar (non-home) */}
          {!isHome && (
            <header className="hidden lg:flex shrink-0 bg-white border-b border-cloud-100 px-5 py-3 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{sectionTitle}</p>
                <p className="text-[13px] text-ink-500 truncate mt-0.5">
                  {displayName}
                  {weather && (
                    <>
                      {' · '}
                      {displayTemp}
                      {unitLbl} · {headerCondition}
                    </>
                  )}
                </p>
              </div>
              {weather && (
                <div className="flex items-center gap-3 shrink-0">
                  <WeatherIcon name={weather.current.icon} className="w-9 h-9" />
                  {topAlert && prefs.notifyAlerts && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-alert-amber">
                      <SeverityDot severity={topAlert.severity} />
                      {topAlert.severity.toUpperCase()}
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                      weather.live ? 'text-mint-400' : 'text-alert-amber'
                    }`}
                    title={weather.liveSource || ''}
                  >
                    <Radio className="w-3 h-3" />
                    {weather.live ? 'LIVE' : 'OFFLINE'}
                  </span>
                </div>
              )}
            </header>
          )}

          {/* Desktop home top strip — frosted over sky */}
          {isHome && (
            <header className="hidden lg:flex shrink-0 px-5 py-3 items-center justify-between gap-4 bg-white/10 border-b border-white/15 backdrop-blur-md">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
                  {lang === 'hi' ? 'मौसम इंटेलिजेंस' : 'Weather intelligence'}
                </p>
                <p className="text-[15px] font-semibold text-white truncate mt-0.5 drop-shadow-sm">{displayName}</p>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-white/75">
                {weather?.live ? (
                  <span className="inline-flex items-center gap-1.5 text-mint-300 font-semibold">
                    <span className="live-dot" /> LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-alert-amber font-semibold">
                    <span className="live-dot-off" /> OFFLINE
                  </span>
                )}
                <span className="text-white/55">
                  {tr(lang, 'updated')} {minsAgo} {tr(lang, 'minAgo')}
                </span>
              </div>
            </header>
          )}

          <main
            className={`flex-1 min-h-0 relative flex flex-col ${
              isHome ? 'bg-transparent' : 'bg-cloud-50'
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={tab + (tab === 'modes' ? modePanel : '') + (tab === 'more' ? morePanel : '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 min-h-0 flex flex-col"
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
                  />
                )}
                {tab === 'chat' && (
                  <ChatTab
                    lang={lang}
                    messages={messages}
                    onSend={onSend}
                    loading={chatLoading}
                    weather={weather}
                    demoQueries={tr(lang, 'demoQueries')}
                  />
                )}
                {tab === 'alerts' && (
                  <AlertsTab
                    lang={lang}
                    weather={weather}
                    onSimulate={onSimulate}
                    nearbyFeed={alertMonitor.feed}
                    monitor={alertMonitor}
                    notifyEnabled={!!prefs.notifyAlerts}
                    onToggleNotify={(v) => updatePrefs({ ...prefs, notifyAlerts: v })}
                  />
                )}
                {tab === 'modes' && (
                  <div className="flex flex-col h-full min-h-0">
                    <div className="shrink-0 px-3 pt-3 pb-2 lg:px-5">
                      <div className="flex gap-1 p-1 bg-cloud-100 rounded-xl border border-cloud-200 max-w-md">
                        {MODE_PANELS.map((p) => {
                          const Icon = p.icon
                          const active = modePanel === p.id
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setModePanel(p.id)}
                              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-semibold transition focus-ring ${
                                active ? 'bg-navy-900 text-white shadow-sm' : 'text-ink-500 hover:text-navy-900'
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
                      {modePanel === 'farm' && <FarmTab lang={lang} weather={weather} />}
                      {modePanel === 'travel' && <TravelTab lang={lang} weather={weather} aqi={aqi} />}
                      {modePanel === 'school' && <SchoolTab lang={lang} weather={weather} aqi={aqi} />}
                    </div>
                  </div>
                )}
                {tab === 'more' && (
                  <div className="flex flex-col h-full min-h-0">
                    <div className="shrink-0 px-3 pt-3 pb-2 lg:hidden">
                      <div className="flex gap-1 p-1 bg-cloud-100 rounded-xl border border-cloud-200">
                        {MORE_PANELS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setMorePanel(p.id)}
                            className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition focus-ring ${
                              morePanel === p.id
                                ? 'bg-navy-900 text-white shadow-sm'
                                : 'text-ink-500 hover:text-navy-900'
                            }`}
                          >
                            {lang === 'hi' ? p.hi : p.en}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
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
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile bottom nav */}
          <nav
            className={`lg:hidden shrink-0 px-2 pt-1.5 pb-safe border-t ${
              isHome ? 'bg-navy-950/55 border-white/10 backdrop-blur-xl' : 'bg-white border-cloud-100'
            }`}
          >
            <div className="flex items-stretch justify-around">
              {TABS.map((tItem) => {
                const Icon = tItem.icon
                const active = tab === tItem.id
                const badge = tItem.id === 'alerts' ? badgeCount : 0
                const activeColor = isHome ? 'text-white' : 'text-navy-900'
                const idleColor = isHome ? 'text-white/45 hover:text-white/75' : 'text-ink-400 hover:text-ink-700'
                return (
                  <button
                    key={tItem.id}
                    type="button"
                    onClick={() => setTab(tItem.id)}
                    className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl transition pressable focus-ring ${
                      active ? activeColor : idleColor
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className={`absolute inset-x-3 inset-y-1 rounded-2xl ${
                          isHome ? 'bg-white/12' : 'bg-sky-400/12'
                        }`}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
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

      {showAbout && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/60 backdrop-blur-sm p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-bubble"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-cloud-100 px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">WeatherGPT · Product</h2>
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="p-1 rounded-lg hover:bg-cloud-100 focus-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-[13px] text-ink-700 leading-relaxed">
              <p className="text-[14px] text-navy-900 font-medium">
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
                    <a className="text-sky-400 font-semibold" href="/api/public" target="_blank" rel="noreferrer">
                      /api/public
                    </a>{' '}
                    — discovery JSON
                  </li>
                  <li>
                    <a className="text-sky-400 font-semibold" href="/llms.txt" target="_blank" rel="noreferrer">
                      /llms.txt
                    </a>{' '}
                    ·{' '}
                    <a className="text-sky-400 font-semibold" href="/sih.html" target="_blank" rel="noreferrer">
                      /sih.html
                    </a>{' '}
                    ·{' '}
                    <a className="text-sky-400 font-semibold" href="/openapi.json" target="_blank" rel="noreferrer">
                      /openapi.json
                    </a>
                  </li>
                </ul>
                <p className="text-[11px] text-ink-500 mt-2">
                  {lang === 'hi'
                    ? 'अगर कोई AI वेबपेज रेंडर नहीं कर पाए तो उसे ये JSON लिंक दो — JS की ज़रूरत नहीं।'
                    : 'If another AI cannot render the SPA, give it these JSON links — no JS required.'}
                </p>
              </Section>
              <p className="text-[11px] text-ink-400 text-center">
                SIH build · {CITY_LIST.length}+ cities · college internal round cleared
              </p>
              <p className="text-[11px] text-center mt-2">
                <a href="?preview=1" className="text-sky-400 font-semibold hover:underline">
                  {lang === 'hi' ? 'डेवइस लैब (M/T/D)' : 'Device lab (M/T/D)'}
                </a>
                <span className="text-ink-400"> · optional</span>
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
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500 mb-1.5">{title}</h3>
      <div className="bg-cloud-50 border border-cloud-100 rounded-xl p-3">{children}</div>
    </div>
  )
}
