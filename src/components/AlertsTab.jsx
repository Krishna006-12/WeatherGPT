import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellRing, CheckCircle2, ChevronRight, MapPin, Radio, RefreshCw, Zap } from 'lucide-react'
import { tr } from '../data/i18n'

function severityMeta(sev) {
  if (sev === 'red') return { label: 'SEVERE', cls: 'sev-severe', bar: 'bg-alert-red' }
  if (sev === 'amber') return { label: 'HIGH', cls: 'sev-high', bar: 'bg-alert-amber' }
  if (sev === 'yellow') return { label: 'MODERATE', cls: 'sev-moderate', bar: 'bg-sun-400' }
  return { label: 'LOW', cls: 'sev-low', bar: 'bg-mint-400' }
}

function sourceBadge(a) {
  if (a.source === 'GDACS') return 'GDACS'
  if (a.source === 'Open-Meteo Flood') return 'FLOOD'
  if (a.external) return 'LIVE'
  if (a.simulated) return 'DEMO'
  return 'MODEL'
}

export default function AlertsTab({
  lang,
  weather,
  onSimulate,
  nearbyFeed,
  monitor,
  notifyEnabled,
  onToggleNotify,
}) {
  const [open, setOpen] = useState(null)
  const [tab, setTab] = useState('local') // local | nearby
  const local = weather?.alerts || []
  const nearby = nearbyFeed?.alerts || []
  const city = weather?.city
    ? lang === 'hi'
      ? weather.city.name_hi || weather.city.name
      : weather.city.name
    : ''

  const all = tab === 'local' ? local : nearby

  const watchLabel = useMemo(() => {
    const pts = nearbyFeed?.points || []
    if (!pts.length) return lang === 'hi' ? 'वॉच लिस्ट' : 'Watch list'
    return pts.map((p) => p.place).slice(0, 5).join(' · ')
  }, [nearbyFeed, lang])

  const perm = monitor?.permission || 'default'
  const supported = monitor?.supported !== false

  return (
    <div className="h-full overflow-y-auto scroll-thin scroll-dark px-3 sm:px-4 lg:px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-navy-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-alert-red" />
            {tr(lang, 'activeAlerts')}
          </h2>
          <p className="text-[12px] text-ink-500 mt-0.5">
            {city ? `${city} · ` : ''}
            {lang === 'hi'
              ? 'लाइव: GDACS · Flood · मौसम थ्रेशोल्ड'
              : 'Live: GDACS · Flood · meteo thresholds'}
          </p>
        </div>
        <button
          type="button"
          onClick={onSimulate}
          className="shrink-0 text-[11px] font-semibold bg-alert-red text-white px-3 py-1.5 rounded-full pulse-alert flex items-center gap-1 pressable focus-ring"
        >
          <Zap className="w-3 h-3" />
          {tr(lang, 'simulateAlert')}
        </button>
      </div>

      {/* Push notifications card */}
      <div className="card p-3.5 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 text-sky-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-navy-900">
              {lang === 'hi' ? 'पुश नोटिफिकेशन' : 'Push notifications'}
            </p>
            <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">
              {lang === 'hi'
                ? 'वॉच शहरों (होम + दिल्ली/लखनऊ…) पर नया अलर्ट आने पर सिस्टम नोटिफिकेशन।'
                : 'OS notification when a new alert hits watched cities (home + metros).'}
            </p>
            <p className="text-[10px] text-ink-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <Radio className="w-3 h-3" />
              {supported
                ? perm === 'granted'
                  ? lang === 'hi'
                    ? 'अनुमति: ऑन'
                    : 'Permission: on'
                  : perm === 'denied'
                    ? lang === 'hi'
                      ? 'अनुमति: ब्लॉक (ब्राउज़र सेटिंग)'
                      : 'Permission: blocked (browser settings)'
                    : lang === 'hi'
                      ? 'अनुमति: अभी नहीं'
                      : 'Permission: not set'
                : lang === 'hi'
                  ? 'इस ब्राउज़र में सपोर्ट नहीं'
                  : 'Not supported in this browser'}
              {nearbyFeed?.live && (
                <span className="inline-flex items-center gap-1 text-mint-400 font-semibold">
                  <span className="live-dot" /> API LIVE
                </span>
              )}
              {monitor?.polling && (
                <span className="text-ink-400">{lang === 'hi' ? 'अपडेट…' : 'Updating…'}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {perm !== 'granted' && supported && (
            <button
              type="button"
              onClick={() => monitor?.enablePush?.()}
              className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-navy-900 text-white pressable focus-ring"
            >
              {lang === 'hi' ? 'नोटिफिकेशन चालू करें' : 'Enable notifications'}
            </button>
          )}
          <button
            type="button"
            onClick={() => monitor?.testNotification?.()}
            disabled={!supported}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-cloud-200 text-navy-900 pressable focus-ring disabled:opacity-40"
          >
            {lang === 'hi' ? 'टेस्ट भेजें' : 'Send test'}
          </button>
          <button
            type="button"
            onClick={() => monitor?.refresh?.()}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-cloud-200 text-navy-900 pressable focus-ring inline-flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${monitor?.polling ? 'animate-spin' : ''}`} />
            {lang === 'hi' ? 'अभी चेक' : 'Check now'}
          </button>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-ink-600">
            <input
              type="checkbox"
              checked={!!notifyEnabled}
              onChange={(e) => onToggleNotify?.(e.target.checked)}
              className="w-4 h-4 accent-navy-900"
            />
            {lang === 'hi' ? 'मॉनिटर ऑन' : 'Monitor on'}
          </label>
        </div>
        <p className="text-[10px] text-ink-400 mt-2 truncate">
          <MapPin className="w-3 h-3 inline mr-1" />
          {lang === 'hi' ? 'वॉच: ' : 'Watching: '}
          {watchLabel}
        </p>
      </div>

      {/* Local vs Nearby */}
      <div className="flex gap-1 p-1 bg-cloud-100 rounded-xl border border-cloud-200 mb-3 max-w-md">
        <button
          type="button"
          onClick={() => setTab('local')}
          className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition focus-ring ${
            tab === 'local' ? 'bg-navy-900 text-white shadow-sm' : 'text-ink-500'
          }`}
        >
          {lang === 'hi' ? `यहाँ (${local.length})` : `Here (${local.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('nearby')}
          className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition focus-ring ${
            tab === 'nearby' ? 'bg-navy-900 text-white shadow-sm' : 'text-ink-500'
          }`}
        >
          {lang === 'hi' ? `नज़दीकी शहर (${nearby.length})` : `Nearby cities (${nearby.length})`}
        </button>
      </div>

      {/* Severity legend */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          { id: 'red', en: 'Severe', hi: 'गंभीर' },
          { id: 'amber', en: 'High', hi: 'उच्च' },
          { id: 'yellow', en: 'Moderate', hi: 'मध्यम' },
          { id: 'green', en: 'Low', hi: 'कम' },
        ].map((s) => {
          const m = severityMeta(s.id === 'green' ? 'green' : s.id)
          return (
            <span key={s.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>
              {m.label} · {lang === 'hi' ? s.hi : s.en}
            </span>
          )
        })}
      </div>

      {all.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-6 text-center"
        >
          <CheckCircle2 className="w-10 h-10 text-mint-400 mx-auto mb-2" />
          <p className="font-semibold text-navy-900">{tr(lang, 'allClear')}</p>
          <p className="text-[13px] text-ink-500 mt-1">{tr(lang, 'noWarnings')}</p>
          <p className="text-[11px] text-ink-400 mt-3">
            {tab === 'nearby'
              ? lang === 'hi'
                ? 'वॉच शहरों पर अभी कोई लाइव अलर्ट नहीं — पोल हर ~3 मिनट'
                : 'No live alerts on watched cities right now — polls ~every 3 min'
              : lang === 'hi'
                ? 'जज डेमो: RED अलर्ट सिमुलेट दबाएँ (नोटिफिकेशन भी टेस्ट)'
                : 'Judge demo: Simulate RED alert (also tests notification)'}
          </p>
          {monitor?.lastError && (
            <p className="text-[11px] text-alert-amber mt-2">{monitor.lastError}</p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {all.map((a, i) => {
            const meta = severityMeta(a.severity)
            return (
              <motion.button
                key={(a.notifyKey || a.id) + i}
                type="button"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.28 }}
                onClick={() => setOpen(a)}
                className="w-full text-left card overflow-hidden hover:border-sky-400/40 hover:shadow-md transition flex pressable focus-ring"
              >
                <div className={`w-1.5 shrink-0 ${meta.bar}`} />
                <div className="flex-1 p-3.5">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.cls}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] bg-navy-900 text-white px-1.5 py-0.5 rounded-full">
                      {sourceBadge(a)}
                    </span>
                    {a.simulated && (
                      <span className="text-[10px] bg-cloud-200 text-ink-500 px-1.5 py-0.5 rounded-full">DEMO</span>
                    )}
                    {a.place && tab === 'nearby' && (
                      <span className="text-[10px] font-semibold text-sky-400 flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {a.place}
                      </span>
                    )}
                    <span className="text-[11px] text-ink-400 ml-auto">
                      {lang === 'hi' ? a.time_hi || a.time : a.time}
                    </span>
                  </div>
                  <p className="font-semibold text-[14px] text-navy-900">
                    {lang === 'hi' ? a.title_hi || a.title : a.title}
                  </p>
                  <p className="text-[12px] text-ink-500 mt-0.5 line-clamp-2">
                    {lang === 'hi' ? a.summary_hi || a.summary : a.summary}
                  </p>
                  {a.distanceKm != null && a.distanceKm > 0 && (
                    <p className="text-[11px] text-ink-400 mt-1">
                      ~{a.distanceKm} km
                      {a.place ? ` · ${a.place}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center pr-3 text-ink-400">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Sources footer */}
      {(nearbyFeed?.sources || weather?.sources) && (
        <div className="mt-4 text-[11px] text-ink-400 space-y-0.5">
          <p className="font-semibold text-ink-500 uppercase tracking-wider text-[10px]">
            {lang === 'hi' ? 'स्रोत' : 'Sources'}
          </p>
          {(nearbyFeed?.sources || []).map((s) => (
            <p key={s.name}>
              {s.name} — {s.role}
            </p>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/50 backdrop-blur-sm p-3"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-0">
                <div className={`w-1.5 ${severityMeta(open.severity).bar}`} />
                <div className="flex-1 p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityMeta(open.severity).cls}`}>
                      {severityMeta(open.severity).label}
                    </span>
                    <span className="text-[11px] font-bold tracking-widest uppercase text-ink-400">
                      {open.severity} WARNING
                    </span>
                  </div>
                  <h3 className="text-[20px] font-semibold text-navy-900 leading-snug">
                    {lang === 'hi' ? open.title_hi || open.title : open.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 mb-4 flex-wrap">
                    <span className="text-[10px] bg-navy-900 text-white px-2 py-0.5 rounded-full">
                      {open.source || 'MODEL'}
                    </span>
                    {open.external && (
                      <span className="text-[10px] bg-mint-400/20 text-navy-900 px-2 py-0.5 rounded-full font-semibold">
                        LIVE FEED
                      </span>
                    )}
                    {(open.place || city) && (
                      <span className="text-[12px] text-ink-500">{open.place || city}</span>
                    )}
                  </div>
                  <div className="bg-cloud-50 border border-cloud-200 rounded-xl p-3.5 text-[13px] leading-relaxed text-ink-700 whitespace-pre-wrap">
                    {lang === 'hi'
                      ? open.officialText_hi || open.officialText || open.summary_hi || open.summary
                      : open.officialText || open.summary}
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
                      {lang === 'hi' ? 'इसका आपके लिए मतलब' : 'What it means for you'}
                    </p>
                    <p className="text-[14px] text-navy-900 leading-relaxed">
                      {lang === 'hi'
                        ? open.meansForYou_hi || open.meansForYou || '—'
                        : open.meansForYou || '—'}
                    </p>
                  </div>
                  <div className="mt-3 card-soft bg-sky-100/40 border border-sky-100 rounded-xl p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
                      {lang === 'hi' ? 'क्या करें' : 'What you should do'}
                    </p>
                    <p className="text-[13px] text-ink-700 leading-relaxed">
                      {open.severity === 'red' || open.severity === 'amber'
                        ? lang === 'hi'
                          ? 'गैर-ज़रूरी बाहर निकलना सीमित करें, आधिकारिक अपडेट देखें।'
                          : 'Limit non-essential outdoor exposure and follow official updates.'
                        : lang === 'hi'
                          ? 'योजना में बफर रखें और अपडेट पर नज़र रखें।'
                          : 'Keep buffer in plans and monitor updates.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    className="mt-5 w-full py-2.5 rounded-xl bg-navy-900 text-white text-[14px] font-medium hover:bg-navy-700 pressable focus-ring"
                  >
                    {lang === 'hi' ? 'बंद करें' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
