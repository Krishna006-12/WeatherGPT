/**
 * Weather-intelligence chat renderer.
 * Structured sections: Summary, Weather facts, Risk, Recommendation, Timing, Confidence, Sources.
 */
import { useMemo } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Clock,
  Gauge,
  BookOpen,
  Sparkles,
  MapPin,
} from 'lucide-react'
import MarkdownText from './MarkdownText'

const SECTION_META = [
  { keys: ['summary', 'सारांश', "what's happening", 'क्या हो रहा', 'context', 'संदर्भ', 'overview'], icon: Sparkles, tone: 'summary' },
  { keys: ['weather facts', 'मौसम तथ्य', 'facts', 'तथ्य', 'locked'], icon: Sparkles, tone: 'summary' },
  { keys: ['risk', 'जोखिम', 'alert', 'अलर्ट', 'impact', 'प्रभाव', 'signals', 'संकेत'], icon: AlertTriangle, tone: 'risk' },
  { keys: ['recommend', 'सिफारिश', 'action', 'करें', 'what you should', 'आपको क्या', 'advice', 'do'], icon: Lightbulb, tone: 'action' },
  { keys: ['timing', 'समय', 'when', 'window', 'outlook', 'आउटलुक', 'expect', 'उम्मीद'], icon: Clock, tone: 'timing' },
  { keys: ['confidence', 'विश्वास', 'certainty'], icon: Gauge, tone: 'confidence' },
  { keys: ['source', 'स्रोत', 'data basis', 'honesty', 'ईमानदारी', 'limitation', 'सीमा'], icon: BookOpen, tone: 'sources' },
  { keys: ['season', 'सीजन', 'calendar', 'कैलेंडर', 'stage', 'अवस्था'], icon: MapPin, tone: 'meta' },
]

function matchMeta(heading) {
  const h = String(heading || '').toLowerCase()
  for (const m of SECTION_META) {
    if (m.keys.some((k) => h.includes(k))) return m
  }
  return { icon: ShieldCheck, tone: 'default' }
}

export function parseIntelligenceSections(text) {
  const raw = String(text || '')
  const lines = raw.split('\n')
  let title = null
  const sections = []
  let cur = null
  let preamble = []

  for (const line of lines) {
    if (line.startsWith('## ') && !title) {
      title = line.replace(/^##\s+/, '').trim()
      continue
    }
    if (line.startsWith('### ')) {
      if (cur) sections.push(cur)
      cur = { heading: line.replace(/^###\s+/, '').trim(), body: [] }
      continue
    }
    if (cur) cur.body.push(line)
    else if (line.trim()) preamble.push(line)
  }
  if (cur) sections.push(cur)

  return {
    title,
    preamble: preamble.join('\n').trim(),
    sections: sections.map((s) => ({
      heading: s.heading,
      body: s.body.join('\n').trim(),
    })),
  }
}

function blocksFromStructured(structured, lang) {
  if (!structured || typeof structured !== 'object') return null
  const hi = lang === 'hi'
  const blocks = []
  const add = (heading, body) => {
    if (body != null && String(body).trim()) blocks.push({ heading, body: String(body) })
  }
  add(hi ? 'सारांश' : 'Summary', structured.summary)
  add(hi ? 'मौसम तथ्य' : 'Weather facts', structured.weather_facts)
  add(hi ? 'जोखिम' : 'Risk', structured.risk)
  add(hi ? 'सिफारिश' : 'Recommendation', structured.recommendation)
  add(hi ? 'समय' : 'Timing', structured.timing)
  if (structured.confidence != null && structured.confidence !== '') {
    add(hi ? 'विश्वास' : 'Confidence', `${structured.confidence}%`)
  }
  add(hi ? 'स्रोत' : 'Sources', structured.sources)
  return blocks.length >= 2 ? blocks : null
}

function SectionCard({ heading, body }) {
  const meta = matchMeta(heading)
  const Icon = meta.icon
  return (
    <div className={`intel-section intel-tone-${meta.tone}`} role="group" aria-label={heading}>
      <div className="intel-section-head">
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
        <h4 className="intel-section-title">{heading}</h4>
      </div>
      <div className="intel-section-body">
        <MarkdownText text={body} />
      </div>
    </div>
  )
}

export default function ChatIntelligence({ text, className = '', meta, structured }) {
  const lang = meta?.lang || 'en'
  const parsed = useMemo(() => parseIntelligenceSections(text), [text])
  const fromStruct = useMemo(() => blocksFromStructured(structured, lang), [structured, lang])
  const sections = fromStruct || parsed.sections
  const hasCards = sections.length >= 2

  if (!hasCards) {
    return (
      <div className={`intel-plain ${className}`.trim()}>
        <MarkdownText text={text} />
        {meta?.confidence != null && (
          <p className="intel-meta-line">
            <Gauge className="w-3 h-3 inline" aria-hidden /> conf{' '}
            {Math.round(meta.confidence <= 1 ? meta.confidence * 100 : meta.confidence)}%
            {meta.source ? ` · ${meta.source}` : ''}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`intel-card-stack ${className}`.trim()}>
      {parsed.title && <h3 className="intel-main-title">{parsed.title.replace(/^🌾\s*/, '')}</h3>}
      {parsed.preamble && !fromStruct ? (
        <div className="intel-preamble">
          <MarkdownText text={parsed.preamble} />
        </div>
      ) : null}
      <div className="intel-sections">
        {sections.map((s, i) => (
          <SectionCard key={`${s.heading}-${i}`} heading={s.heading} body={s.body} />
        ))}
      </div>
      {(meta?.confidence != null || meta?.source) && (
        <div className="intel-footer-meta" aria-label="confidence and source">
          {meta.confidence != null && (
            <span>
              <Gauge className="w-3 h-3" aria-hidden />{' '}
              {Math.round(meta.confidence <= 1 ? meta.confidence * 100 : meta.confidence)}%
            </span>
          )}
          {meta.source && (
            <span className="truncate max-w-[14rem]" title={meta.source}>
              {meta.source}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
