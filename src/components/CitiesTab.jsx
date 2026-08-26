import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe2, Loader2, MapPin, Navigation, Search, Sparkles, X, Star } from 'lucide-react'
import { CITY_LIST } from '../data/cities'
import { searchCities, resolveCoords } from '../services/geocode'
import { tr } from '../data/i18n'
import { SeverityDot } from './Icons'

const ease = [0.22, 1, 0.36, 1]

export default function CitiesTab({ lang, cityId, onSelect, weatherMap, recentCities = [] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef(null)
  const reqId = useRef(0)

  useEffect(() => {
    const s = q.trim()
    if (s.length < 2) {
      setResults([])
      setSearching(false)
      setError('')
      return
    }

    setSearching(true)
    setError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqId.current
      try {
        const list = await searchCities(s, { count: 8 })
        if (myReq !== reqId.current) return
        setResults(list)
        if (!list.length) {
          setError(
            lang === 'hi'
              ? 'कोई शहर नहीं मिला — दूसरी स्पेलिंग आज़माएँ'
              : 'No cities found — try another spelling'
          )
        }
      } catch {
        if (myReq !== reqId.current) return
        setError(lang === 'hi' ? 'खोज असफल — नेटवर्क जाँचें' : 'Search failed — check network')
        setResults([])
      } finally {
        if (myReq === reqId.current) setSearching(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q, lang])

  const popular = useMemo(() => CITY_LIST.slice(0, 12), [])
  const recent = useMemo(() => {
    return recentCities.filter((c) => c && c.id !== cityId).slice(0, 6)
  }, [recentCities, cityId])
  const showSearch = q.trim().length >= 2

  const useGeo = () => {
    if (!navigator.geolocation) {
      setError(lang === 'hi' ? 'GPS उपलब्ध नहीं' : 'GPS not available')
      return
    }
    setGpsLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const city = await resolveCoords(lat, lon)
          onSelect(city)
        } catch {
          setError(lang === 'hi' ? 'लोकेशन हल नहीं हुई' : 'Could not resolve location')
        } finally {
          setGpsLoading(false)
        }
      },
      () => {
        setGpsLoading(false)
        setError(lang === 'hi' ? 'लोकेशन अनुमति दें' : 'Please allow location access')
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }

  const pick = (city) => {
    setQ('')
    setResults([])
    onSelect(city)
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin scroll-dark page-pad py-4">
      <div className="flex gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 input-glass px-3 py-2.5 text-white">
          {searching ? (
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-white/40 shrink-0" />
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              lang === 'hi'
                ? 'कोई भी शहर — दुबई, पेरिस, आगरा…'
                : 'Any city — Dubai, Paris, Agra…'
            }
            className="flex-1 text-[14px] outline-none bg-transparent min-w-0 placeholder:text-white/35"
            autoComplete="off"
            autoCorrect="off"
            aria-label={lang === 'hi' ? 'शहर खोजें' : 'Search city'}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="text-white/40 hover:text-white/70 p-0.5 focus-ring rounded"
              aria-label="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={useGeo}
          disabled={gpsLoading}
          className="shrink-0 px-3.5 rounded-2xl bg-sky-400/90 hover:bg-sky-400 text-navy-950 text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60 pressable btn-glass focus-ring border border-white/10 shadow-md shadow-sky-400/20 transition-all duration-200"
          title={lang === 'hi' ? 'मेरी लोकेशन' : 'Use my location'}
        >
          {gpsLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          {lang === 'hi' ? 'GPS' : 'My location'}
        </button>
      </div>

      <p className="text-[11px] text-white/40 mb-3 flex items-center gap-1 px-0.5">
        <Globe2 className="w-3 h-3 text-sky-400" />
        {lang === 'hi'
          ? 'स्मार्ट खोज · बड़े शहर पहले · गाँव-क्लोन छिपे'
          : 'Smart search · major cities first · village clones hidden'}
      </p>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 text-[12px] text-alert-amber bg-alert-amber/10 border border-alert-amber/30 rounded-xl px-3 py-2 text-white"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {showSearch ? (
        <div className="space-y-2 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sun-400" />
            {lang === 'hi' ? 'खोज परिणाम' : 'Search results'}
            {searching && <span className="normal-case font-normal text-white/40">…</span>}
            {!searching && results.length > 0 && (
              <span className="normal-case font-normal text-white/40 ml-1">({results.length})</span>
            )}
          </p>
          {!searching && results.length === 0 && !error && (
            <p className="text-[13px] text-white/40 py-6 text-center">
              {lang === 'hi' ? 'कुछ नहीं मिला' : 'Nothing found'}
            </p>
          )}
          <AnimatePresence mode="popLayout">
            {results.map((c, i) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: i * 0.04, duration: 0.28, ease }}
              >
                <CityRow
                  c={c}
                  lang={lang}
                  active={c.id === cityId}
                  wx={weatherMap?.[c.id]}
                  onClick={() => pick(c)}
                  primary={i === 0}
                  badge={
                    i === 0
                      ? lang === 'hi'
                        ? 'बेस्ट'
                        : 'BEST'
                      : c.population >= 100000
                        ? null
                        : c.dynamic
                          ? lang === 'hi'
                            ? 'नया'
                            : 'NEW'
                          : null
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <Section title={lang === 'hi' ? 'हाल ही में' : 'Recent'}>
              {recent.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <CityRow
                    c={c}
                    lang={lang}
                    active={c.id === cityId}
                    wx={weatherMap?.[c.id]}
                    onClick={() => pick(c)}
                  />
                </motion.div>
              ))}
            </Section>
          )}

          <Section title={lang === 'hi' ? 'लोकप्रिय भारत' : 'Popular India'}>
            {popular.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
              >
                <CityRow
                  c={c}
                  lang={lang}
                  active={c.id === cityId}
                  wx={weatherMap?.[c.id]}
                  onClick={() => pick(c)}
                />
              </motion.div>
            ))}
          </Section>

          <p className="text-[11px] text-white/40 text-center py-3">
            {lang === 'hi'
              ? 'ऊपर सर्च में कोई भी शहर टाइप करें'
              : 'Type any city above — worldwide'}
          </p>
        </>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function formatPop(n) {
  if (!n || n < 1000) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}

function CityRow({ c, lang, active, wx, onClick, badge, primary }) {
  const alert = wx?.alerts?.[0]
  const cc = c.countryCode || ''
  const isIntl = cc && cc !== 'IN'
  const countryLabel = c.countryShort || c.country || cc
  const pop = formatPop(c.population)

  // India: state · intl: Country (admin if useful)
  let sub
  if (isIntl) {
    const admin = c.state || ''
    // state already may be "Dubai, UAE" or just "UAE"
    if (!admin || admin === c.name || admin === countryLabel || admin.includes(countryLabel)) {
      sub = countryLabel + (pop ? ` · ${pop}` : '')
    } else if (admin.includes(',')) {
      sub = admin + (pop ? ` · ${pop}` : '')
    } else {
      sub = `${admin} · ${countryLabel}` + (pop ? ` · ${pop}` : '')
    }
  } else {
    const st = lang === 'hi' ? c.state_hi || c.state : c.state
    sub = st + (pop ? ` · ${pop}` : '')
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition pressable ${
        active
          ? 'bg-navy-900 text-white border-navy-900 shadow-lg shadow-navy-900/20'
          : primary
            ? 'bg-white/6 border-sky-400/50 shadow-md shadow-sky-400/10 ring-1 ring-sky-400/20'
            : 'bg-white/6 border-white/10 hover:border-sky-400/50 hover:shadow-sm'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          active ? 'bg-white/10' : primary ? 'bg-sky-100' : 'bg-sky-100/80'
        }`}
      >
        {primary && !active ? (
          <Star className="w-4 h-4 text-sun-400 fill-sun-400/30" />
        ) : (
          <MapPin className={`w-4 h-4 ${active ? 'text-sun-400' : 'text-sky-400'}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`font-semibold text-[14px] truncate ${active ? 'text-white' : 'text-white'}`}>
            {lang === 'hi' ? c.name_hi || c.name : c.name}
          </p>
          {badge && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                active
                  ? 'bg-sun-400/20 text-sun-300'
                  : badge === 'BEST' || badge === 'बेस्ट'
                    ? 'bg-sun-400/20 text-white'
                    : 'bg-mint-400/20 text-mint-300'
              }`}
            >
              {badge}
            </span>
          )}
          {isIntl && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/15 text-white/80' : 'bg-cloud-200 text-white/60'
              }`}
            >
              {cc}
            </span>
          )}
        </div>
        <p className={`text-[11px] truncate ${active ? 'text-white/60' : 'text-white/40'}`}>{sub}</p>
      </div>
      <div className="text-right shrink-0">
        {wx ? (
          <>
            <p className={`text-[16px] font-semibold ${active ? 'text-white' : 'text-white'}`}>
              {wx.current.temp}°
            </p>
            {alert ? (
              <span className="inline-flex items-center gap-1 text-[10px]">
                <SeverityDot severity={alert.severity} />
                <span className={active ? 'text-white/70' : 'text-white/55'}>{alert.severity}</span>
              </span>
            ) : (
              <span className={`text-[10px] ${active ? 'text-mint-300' : 'text-mint-400'}`}>
                {tr(lang, 'allClear')}
              </span>
            )}
          </>
        ) : (
          <span className={`text-[11px] ${active ? 'text-white/50' : 'text-white/40'}`}>→</span>
        )}
      </div>
    </button>
  )
}
