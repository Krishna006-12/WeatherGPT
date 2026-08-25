import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Send, Sparkles, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import MarkdownText from './MarkdownText'
import { SeverityDot } from './Icons'
import { tr } from '../data/i18n'
import { speakText, stopSpeaking, ttsSupported, isSpeaking } from '../services/voice'

export default function ChatTab({
  lang,
  messages,
  onSend,
  loading,
  weather,
  demoQueries,
}) {
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [speakingId, setSpeakingId] = useState(null)
  const bottomRef = useRef(null)
  const recogRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const submit = (text) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    onSend(q)
  }

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert(lang === 'hi' ? 'इस ब्राउज़र में वॉइस सपोर्ट नहीं' : 'Voice not supported in this browser')
      return
    }
    if (listening && recogRef.current) {
      recogRef.current.stop()
      setListening(false)
      return
    }
    const r = new SR()
    recogRef.current = r
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    r.interimResults = false
    r.onresult = (e) => {
      // Voice often mis-hears Noida→nodia, Gurugram→gurgaon, etc.
      // AI layer also normalizes; light client cleanup helps UX in the bubble.
      let said = e.results[0][0].transcript || ''
      said = said
        .replace(/\bnodia\b/gi, 'Noida')
        .replace(/\bnoeda\b/gi, 'Noida')
        .replace(/\bgurgoan\b/gi, 'Gurugram')
        .replace(/\bdubay\b/gi, 'Dubai')
      setInput(said)
      setListening(false)
      submit(said)
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    setListening(true)
    r.start()
  }

  const promptSuggestions =
    lang === 'hi'
      ? [
          'आज का पूर्वानुमान समझाओ',
          'जलवायु रुझान बताओ',
          'GFS और ECMWF तुलना',
          'सिंचाई करूँ?',
        ]
      : [
          "Explain today's forecast",
          'Show climate trends',
          'Compare GFS vs ECMWF',
          'Should I irrigate?',
        ]

  const toggleSpeak = (m) => {
    if (!ttsSupported()) {
      alert(lang === 'hi' ? 'इस ब्राउज़र में आवाज़ (TTS) नहीं' : 'Text-to-speech not supported here')
      return
    }
    if (speakingId === m.id && isSpeaking()) {
      stopSpeaking()
      setSpeakingId(null)
      return
    }
    stopSpeaking()
    const r = speakText(m.text, { lang: m.lang || lang })
    if (r.ok) setSpeakingId(m.id)
  }

  const chipsSource = demoQueries?.length ? demoQueries : promptSuggestions

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 overflow-y-auto scroll-thin px-3 sm:px-4 lg:px-5 py-3 space-y-3">
        {messages.length <= 1 && (
          <div className="mb-2 max-w-2xl">
            <div className="card p-3.5 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-sun-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  {lang === 'hi' ? 'AI मौसम सहायक' : 'AI weather assistant'}
                </p>
              </div>
              <p className="text-[13px] text-ink-600 leading-relaxed">
                {lang === 'hi'
                  ? 'पूर्वानुमान, यात्रा/स्कूल/कृषि जोखिम, अलर्ट — सब मौजूदा शहर के लाइव डेटा पर।'
                  : 'Forecast explainers, travel/school/farm risk, alerts — grounded on live data for the current city.'}
              </p>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                {tr(lang, 'tryDemo')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chipsSource.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submit(q)}
                  className="text-left text-[13px] px-3 py-2.5 rounded-xl bg-white border border-cloud-200 text-ink-700 hover:border-sky-400/60 hover:bg-sky-100/40 transition shadow-sm pressable focus-ring"
                >
                  <span className="text-sky-400 font-mono text-[11px] mr-1">“</span>
                  {q}
                  <span className="text-sky-400 font-mono text-[11px]">”</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            m={m}
            lang={lang}
            speaking={speakingId === m.id}
            onSpeak={() => toggleSpeak(m)}
          />
        ))}

        {loading && (
          <div className="flex justify-start animate-bubble">
            <div className="bg-white border border-cloud-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[12px] text-ink-500 mb-1">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 typing-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 typing-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 typing-dot" />
                </span>
                {tr(lang, 'thinking')}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* chips from last assistant */}
      {messages.length > 0 && messages[messages.length - 1].chips && !loading && (
        <div className="px-3 sm:px-4 pb-2 flex gap-2 overflow-x-auto scroll-thin">
          {messages[messages.length - 1].chips.map((c) => (
            <button
              key={c}
              onClick={() => submit(c)}
              className="shrink-0 text-[12px] px-3 py-1.5 rounded-full bg-navy-900 text-white/90 hover:bg-navy-700 transition"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 sm:px-4 pb-3 pt-1">
        <div className="flex items-end gap-2 bg-white border border-cloud-200 rounded-2xl shadow-lg shadow-navy-900/5 p-1.5 focus-within:border-sky-400/70 focus-within:shadow-sky-400/10 transition">
          <button
            type="button"
            onClick={toggleVoice}
            title={tr(lang, 'voiceHint')}
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition pressable ${
              listening
                ? 'bg-alert-red text-white pulse-alert'
                : 'bg-cloud-100 text-ink-500 hover:bg-cloud-200'
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={listening ? tr(lang, 'listening') : tr(lang, 'typePlaceholder')}
            className="flex-1 resize-none bg-transparent text-[14px] text-ink-900 placeholder:text-ink-400 py-2.5 outline-none max-h-28"
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={!input.trim() || loading}
            className="shrink-0 w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center hover:bg-navy-700 disabled:opacity-40 transition pressable"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-ink-400 text-center mt-1.5 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-mint-400" />
          {weather?.live ? tr(lang, 'backendLive') : tr(lang, 'backendMock')}
          {' · '}
          {tr(lang, 'powerBy')}
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ m, lang, speaking, onSpeak }) {
  const isUser = m.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[92%] sm:max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
          isUser
            ? 'bg-navy-900 text-white rounded-br-md'
            : m.type === 'outofscope'
              ? 'bg-white border border-alert-amber/40 rounded-bl-md'
              : m.type === 'alert'
                ? 'bg-white border border-alert-red/30 rounded-bl-md'
                : m.type === 'travel' ||
                    m.type === 'school' ||
                    m.type === 'predict' ||
                    m.type === 'climate' ||
                    m.type === 'models'
                  ? 'bg-white border border-sky-400/25 rounded-bl-md'
                  : 'bg-white border border-cloud-200 rounded-bl-md'
        }`}
      >
        {!isUser && m.type === 'alert' && m.alertData && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <SeverityDot severity={m.alertData.severity} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-alert-red">
              {m.alertData.severity} alert
            </span>
          </div>
        )}
        {isUser ? (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
        ) : (
          <MarkdownText text={m.text} className="text-[14px] text-ink-800" />
        )}
        {!isUser && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {m.source && (
              <span className="text-[10px] text-ink-400 font-mono bg-cloud-100 px-1.5 py-0.5 rounded">
                {m.source}
              </span>
            )}
            {typeof m.confidence === 'number' && (
              <span className="text-[10px] text-mint-400 font-semibold">
                {tr(lang, 'confidence')} {Math.round(m.confidence * 100)}%
              </span>
            )}
            <button
              type="button"
              onClick={onSpeak}
              className="text-[10px] font-semibold text-sky-400 inline-flex items-center gap-0.5 focus-ring rounded"
              title={lang === 'hi' ? 'सुनें' : 'Listen'}
            >
              {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {speaking ? (lang === 'hi' ? 'रोकें' : 'Stop') : lang === 'hi' ? 'सुनें' : 'Listen'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
