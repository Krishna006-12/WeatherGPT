import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Send, Sparkles, ShieldCheck, Volume2, VolumeX, MapPin, Radio } from 'lucide-react'
import MarkdownText from './MarkdownText.jsx'
import { SeverityDot } from './Icons.jsx'
import { tr } from '../data/i18n.js'
import { speakText, stopSpeaking, ttsSupported, isSpeaking } from '../services/voice.js'

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
      ? ['आज का पूर्वानुमान समझाओ', 'जलवायु रुझान बताओ', 'GFS और ECMWF तुलना', 'सिंचाई करूँ?']
      : ["Explain today's forecast", 'Show climate trends', 'Compare GFS vs ECMWF', 'Should I irrigate?']

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
  const homeLabel = weather?.city
    ? lang === 'hi'
      ? weather.city.name_hi || weather.city.name
      : weather.city.name
    : ''
  const homeTemp = weather?.current?.temp
  const homeCond =
    lang === 'hi' ? weather?.current?.condition_hi || weather?.current?.condition : weather?.current?.condition

  return (
    <div className="flex flex-col h-full min-h-0">
      {weather?.current && (
        <div className="shrink-0 px-3 sm:px-4 lg:px-6 pt-3 pb-2 border-b border-white/8 bg-white/[0.04] backdrop-blur-md">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-white/8 border border-white/12 rounded-full px-3 py-1">
                <MapPin className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span className="truncate">
                  {homeLabel}
                  {homeTemp != null && (
                    <span className="text-white/55 font-medium">
                      {' '}
                      · {Math.round(homeTemp)}°C
                      {homeCond ? ` · ${homeCond}` : ''}
                    </span>
                  )}
                </span>
              </span>
              <span className="hidden sm:inline text-[11px] text-white/40">
                {lang === 'hi'
                  ? 'डिफ़ॉल्ट शहर · सवाल में दूसरा नाम लिखें'
                  : 'Default city · name another in your question'}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                weather.live ? 'text-mint-300' : 'text-alert-amber'
              }`}
            >
              <Radio className="w-3 h-3" />
              {weather.live ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-thin scroll-dark px-3 sm:px-5 lg:px-8 py-4 space-y-4">
        <div className="max-w-3xl mx-auto w-full space-y-4">
          {messages.length <= 1 && (
            <div className="mb-1">
              <div className="dash-glass p-4 mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-sun-300" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    {lang === 'hi' ? 'AI मौसम सहायक' : 'AI weather assistant'}
                  </p>
                </div>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  {lang === 'hi'
                    ? 'पूर्वानुमान, यात्रा/स्कूल/कृषि जोखिम, अलर्ट — लाइव डेटा पर grounded। दूसरे शहर का नाम सवाल में लिखें।'
                    : 'Forecast explainers, travel/school/farm risk, alerts — grounded on live data. Name any city in the question.'}
                </p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                {tr(lang, 'tryDemo')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {chipsSource.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => submit(q)}
                    className="text-left text-[13px] px-3.5 py-3 rounded-xl bg-white/6 border border-white/10 text-white/85 hover:border-sky-400/40 hover:bg-white/10 transition pressable focus-ring"
                  >
                    <span className="text-sky-300 font-mono text-[11px] mr-1">“</span>
                    {q}
                    <span className="text-sky-300 font-mono text-[11px]">”</span>
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
              <div className="dash-glass rounded-2xl rounded-bl-md px-5 py-4 max-w-md">
                <div className="flex items-center gap-2 text-[12px] text-white/50">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300 typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300 typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300 typing-dot" />
                  </span>
                  {tr(lang, 'thinking')}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {messages.length > 0 && messages[messages.length - 1].chips && !loading && (
        <div className="px-3 sm:px-5 lg:px-8 pb-2">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto scroll-thin scroll-dark">
            {messages[messages.length - 1].chips.map((c) => (
              <button
                key={c}
                onClick={() => submit(c)}
                className="shrink-0 text-[12px] px-3 py-1.5 rounded-full bg-sky-400/20 border border-white/15 text-white/90 hover:bg-sky-400/30 transition"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 px-3 sm:px-5 lg:px-8 pb-3 pt-1 bg-gradient-to-t from-navy-950/80 via-navy-950/40 to-transparent">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 dash-glass p-1.5 focus-within:border-sky-400/40 transition">
            <button
              type="button"
              onClick={toggleVoice}
              title={tr(lang, 'voiceHint')}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition pressable ${
                listening
                  ? 'bg-alert-red text-white pulse-alert'
                  : 'bg-white/8 text-white/60 hover:bg-white/12'
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
              className="flex-1 resize-none bg-transparent text-[14px] text-white placeholder:text-white/35 py-2.5 outline-none max-h-28"
            />
            <button
              type="button"
              onClick={() => submit()}
              disabled={!input.trim() || loading}
              className="shrink-0 w-10 h-10 rounded-xl bg-sky-400 text-navy-950 flex items-center justify-center hover:bg-sky-300 disabled:opacity-40 transition pressable"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/35 text-center mt-1.5 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-mint-300" />
            {weather?.live ? tr(lang, 'backendLive') : tr(lang, 'backendMock')}
            {' · '}
            {tr(lang, 'powerBy')}
          </p>
        </div>
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
        className={`w-full sm:w-auto ${
          isUser ? 'max-w-[min(92%,28rem)]' : 'max-w-full sm:max-w-[min(100%,40rem)]'
        } rounded-2xl ${
          isUser
            ? 'bg-sky-400/90 text-navy-950 rounded-br-md px-4 py-3 shadow-lg shadow-sky-400/15'
            : m.type === 'outofscope'
              ? 'dash-glass border-alert-amber/35 rounded-bl-md px-4 sm:px-5 py-3.5 sm:py-4'
              : m.type === 'alert'
                ? 'dash-glass border-alert-red/35 rounded-bl-md px-4 sm:px-5 py-3.5 sm:py-4'
                : 'dash-glass rounded-bl-md px-4 sm:px-5 py-3.5 sm:py-4'
        }`}
      >
        {!isUser && m.type === 'alert' && m.alertData && (
          <div className="flex items-center gap-1.5 mb-2">
            <SeverityDot severity={m.alertData.severity} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-alert-red">
              {m.alertData.severity} alert
            </span>
          </div>
        )}
        {!isUser && m.type === 'crop' && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mint-300/90">
              {lang === 'hi' ? 'फसल बुद्धिमत्ता' : 'Crop Intelligence'}
            </span>
          </div>
        )}
        {isUser ? (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>
        ) : (
          <div className="chat-md-dark">
            <MarkdownText text={m.text} className="text-[14px] text-white/90" />
          </div>
        )}
        {!isUser && (
          <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-2">
            {m.source && (
              <span className="text-[10px] text-white/45 font-mono bg-white/8 px-1.5 py-0.5 rounded max-w-full break-words">
                {m.source}
              </span>
            )}
            {typeof m.confidence === 'number' && (
              <span className="text-[10px] text-mint-300 font-semibold">
                {tr(lang, 'confidence')} {Math.round(m.confidence * 100)}%
              </span>
            )}
            <button
              type="button"
              onClick={onSpeak}
              className="text-[10px] font-semibold text-sky-300 inline-flex items-center gap-0.5 focus-ring rounded ml-auto sm:ml-0"
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
