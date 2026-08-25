/** Lightweight markdown: # headings, **bold**, bullets, line breaks — airy spacing for chat */
export default function MarkdownText({ text = '', className = '' }) {
  const lines = String(text).split('\n')
  return (
    <div className={`space-y-1.5 ${className}`}>
      {lines.map((line, i) => {
        const t = line.trimEnd()
        if (t.trim() === '') return <div key={i} className="h-2" />

        if (t.startsWith('## ')) {
          return (
            <h3 key={i} className="text-[16px] font-semibold text-navy-900 pt-0.5 pb-1 leading-snug tracking-tight">
              {renderInline(t.slice(3))}
            </h3>
          )
        }
        if (t.startsWith('### ')) {
          return (
            <h4
              key={i}
              className="text-[11px] font-bold uppercase tracking-wider text-sky-400 pt-2.5 pb-1 first:pt-0"
            >
              {renderInline(t.slice(4))}
            </h4>
          )
        }
        if (/^[-•]\s+/.test(t.trim())) {
          const body = t.trim().replace(/^[-•]\s+/, '')
          return (
            <div key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-800 pl-0.5 py-0.5">
              <span className="text-sky-400 shrink-0 mt-[3px]">•</span>
              <span className="min-w-0">{renderInline(body)}</span>
            </div>
          )
        }
        if (/^\d+\.\s+/.test(t.trim())) {
          const m = t.trim().match(/^(\d+)\.\s+(.*)$/)
          return (
            <div key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-800 pl-0.5 py-0.5">
              <span className="text-sky-400 font-semibold shrink-0 tabular-nums">{m[1]}.</span>
              <span className="min-w-0">{renderInline(m[2])}</span>
            </div>
          )
        }
        return (
          <p key={i} className="text-[14px] leading-relaxed text-ink-800">
            {renderInline(t)}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(line) {
  const parts = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m
  let k = 0
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(<span key={k++}>{line.slice(last, m.index)}</span>)
    parts.push(
      <strong key={k++} className="font-semibold text-navy-900">
        {m[1]}
      </strong>
    )
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push(<span key={k++}>{line.slice(last)}</span>)
  return parts.length ? parts : line
}
