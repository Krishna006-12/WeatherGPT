import { Bell, Gauge, Home, Languages, RotateCcw, Shield, Smartphone, Thermometer } from 'lucide-react'
import { clearChatHistory } from '../services/storage'
import { CITY_LIST } from '../data/cities'
import { motion } from 'framer-motion'

export default function SettingsTab({ lang, prefs, onChangePrefs, onResetOnboarding, cityId, monitor }) {
  const set = (patch) => onChangePrefs({ ...prefs, ...patch })
  const perm = monitor?.permission || 'default'

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="h-full overflow-y-auto scroll-thin scroll-dark px-3 sm:px-4 py-4 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold text-navy-900">
          {lang === 'hi' ? 'सेटिंग्स' : 'Settings'}
        </h2>
        <p className="text-[12px] text-ink-500">
          {lang === 'hi' ? 'प्रोडक्ट प्रेफरेंस · डिवाइस पर सेव' : 'Product preferences · saved on device'}
        </p>
      </div>

      <Section
        icon={<Languages className="w-4 h-4 text-sky-400" />}
        title={lang === 'hi' ? 'भाषा' : 'Language'}
      >
        <div className="flex gap-2">
          {[
            { id: 'en', label: 'English' },
            { id: 'hi', label: 'हिंदी' },
          ].map((o) => (
            <Chip key={o.id} active={prefs.lang === o.id} onClick={() => set({ lang: o.id })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        icon={<Thermometer className="w-4 h-4 text-sun-400" />}
        title={lang === 'hi' ? 'तापमान इकाई' : 'Temperature unit'}
      >
        <div className="flex gap-2">
          {[
            { id: 'C', label: '°C' },
            { id: 'F', label: '°F' },
          ].map((o) => (
            <Chip key={o.id} active={prefs.units === o.id} onClick={() => set({ units: o.id })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        icon={<Gauge className="w-4 h-4 text-mint-400" />}
        title={lang === 'hi' ? 'डिफ़ॉल्ट मोड' : 'Default mode'}
      >
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'farm', en: 'Farm', hi: 'कृषि' },
            { id: 'travel', en: 'Travel', hi: 'यात्रा' },
            { id: 'school', en: 'School', hi: 'स्कूल' },
          ].map((o) => (
            <Chip key={o.id} active={prefs.defaultMode === o.id} onClick={() => set({ defaultMode: o.id })}>
              {lang === 'hi' ? o.hi : o.en}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        icon={<Home className="w-4 h-4 text-sky-400" />}
        title={lang === 'hi' ? 'होम शहर' : 'Home city'}
      >
        <select
          value={prefs.homeCityId || 'kanpur'}
          onChange={(e) => set({ homeCityId: e.target.value })}
          className="w-full text-[13px] border border-cloud-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:border-sky-400"
        >
          {CITY_LIST.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === 'hi' ? c.name_hi : c.name} — {c.state}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-ink-400 mt-1.5">
          {lang === 'hi'
            ? 'ऐप खुलने पर यही शहर लोड होगा (अगली बार)'
            : 'Loaded on next app open'}
        </p>
      </Section>

      <Section
        icon={<Bell className="w-4 h-4 text-alert-amber" />}
        title={lang === 'hi' ? 'अलर्ट व नोटिफिकेशन' : 'Alerts & notifications'}
      >
        <label className="flex items-center justify-between gap-3 text-[13px] text-ink-700 mb-2">
          <span>
            {lang === 'hi' ? 'लाइव अलर्ट मॉनिटर (मल्टी-सिटी)' : 'Live alert monitor (multi-city)'}
          </span>
          <input
            type="checkbox"
            checked={!!prefs.notifyAlerts}
            onChange={(e) => set({ notifyAlerts: e.target.checked })}
            className="w-4 h-4 accent-navy-900"
          />
        </label>
        <p className="text-[11px] text-ink-500 mb-2 leading-relaxed">
          {lang === 'hi'
            ? 'होम + दिल्ली/लखनऊ/मुंबई… पर /api/alerts पोल → नया अलर्ट आने पर पुश।'
            : 'Polls /api/alerts for home + metros → pushes when something new appears.'}
        </p>
        <p className="text-[11px] text-ink-400 mb-2">
          {lang === 'hi' ? 'ब्राउज़र अनुमति: ' : 'Browser permission: '}
          <strong className="text-ink-600">{perm}</strong>
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => monitor?.enablePush?.()}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-navy-900 text-white"
          >
            {lang === 'hi' ? 'अनुमति माँगें' : 'Request permission'}
          </button>
          <button
            type="button"
            onClick={() => monitor?.testNotification?.()}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-cloud-200"
          >
            {lang === 'hi' ? 'टेस्ट नोटिफिकेशन' : 'Test notification'}
          </button>
        </div>
        <p className="text-[12px] font-semibold text-ink-700 mb-1.5">
          {lang === 'hi' ? 'न्यूनतम गंभीरता' : 'Minimum severity to notify'}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'yellow', en: 'Yellow+', hi: 'येलो+' },
            { id: 'amber', en: 'Amber+', hi: 'एम्बर+' },
            { id: 'red', en: 'Red only', hi: 'केवल रेड' },
          ].map((o) => (
            <Chip
              key={o.id}
              active={(prefs.notifyMinSeverity || 'yellow') === o.id}
              onClick={() => set({ notifyMinSeverity: o.id })}
            >
              {lang === 'hi' ? o.hi : o.en}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        icon={<Smartphone className="w-4 h-4 text-ink-500" />}
        title={lang === 'hi' ? 'डेटा व प्राइवेसी' : 'Data & privacy'}
      >
        <ul className="text-[12px] text-ink-600 space-y-1.5 leading-relaxed">
          <li>• {lang === 'hi' ? 'चैट इतिहास इसी डिवाइस पर सेव' : 'Chat history stays on this device only'}</li>
          <li>• {lang === 'hi' ? 'कोई अकाउंट लॉगिन नहीं' : 'No account login required'}</li>
          <li>• {lang === 'hi' ? 'मौसम: Open-Meteo · अलर्ट: GDACS/Flood/model' : 'Weather: Open-Meteo · Alerts: GDACS/Flood/model'}</li>
        </ul>
        <button
          type="button"
          onClick={() => {
            clearChatHistory(cityId)
            clearChatHistory()
            alert(lang === 'hi' ? 'चैट इतिहास साफ़' : 'Chat history cleared')
          }}
          className="mt-3 text-[12px] font-semibold text-alert-red flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {lang === 'hi' ? 'चैट इतिहास मिटाएँ' : 'Clear chat history'}
        </button>
      </Section>

      <Section icon={<Shield className="w-4 h-4 text-mint-400" />} title={lang === 'hi' ? 'ऐप' : 'App'}>
        <p className="text-[12px] text-ink-600 leading-relaxed">
          WeatherGPT v2 · Product build
          <br />
          {lang === 'hi'
            ? 'PWA इंस्टॉल: ब्राउज़र मेनू → Home screen पर जोड़ें'
            : 'Install PWA: browser menu → Add to Home Screen'}
        </p>
        <button
          type="button"
          onClick={onResetOnboarding}
          className="mt-2 text-[12px] font-semibold text-sky-400"
        >
          {lang === 'hi' ? 'ऑनबोर्डिंग फिर दिखाएँ' : 'Replay onboarding'}
        </button>
      </Section>
    </motion.div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-white border border-cloud-200 rounded-2xl p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="text-[13px] font-semibold text-navy-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${
        active
          ? 'bg-navy-900 text-white border-navy-900'
          : 'bg-cloud-50 text-ink-600 border-cloud-200 hover:border-sky-400/50'
      }`}
    >
      {children}
    </button>
  )
}
