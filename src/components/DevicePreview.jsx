import { useCallback, useEffect, useMemo, useState } from 'react'
import { Monitor, Smartphone, Tablet, Maximize2, X } from 'lucide-react'
import App from '../App.jsx'

const MODES = [
  {
    id: 'mobile',
    label: 'Mobile',
    short: 'M',
    icon: Smartphone,
    width: 390,
    height: 844,
    radius: 36,
    bezel: true,
    hint: '390×844',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    short: 'T',
    icon: Tablet,
    width: 768,
    height: 1024,
    radius: 24,
    bezel: true,
    hint: '768×1024',
  },
  {
    id: 'desktop',
    label: 'Desktop',
    short: 'D',
    icon: Monitor,
    width: 1280,
    height: 800,
    radius: 16,
    bezel: false,
    hint: '1280×800',
  },
  {
    id: 'responsive',
    label: 'Full',
    short: 'F',
    icon: Maximize2,
    width: null,
    height: null,
    radius: 0,
    bezel: false,
    hint: 'Real window',
  },
]

const MODE_KEY = 'wgpt_device_preview_mode_v2'

function loadMode() {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (MODES.some((m) => m.id === v)) return v
  } catch {
    /* ignore */
  }
  return 'mobile'
}

function saveMode(id) {
  try {
    localStorage.setItem(MODE_KEY, id)
  } catch {
    /* ignore */
  }
}

function embedSrc() {
  const u = new URL(window.location.href)
  u.searchParams.set('embed', '1')
  u.searchParams.delete('preview')
  return u.pathname + u.search + u.hash
}

function exitPreviewUrl() {
  const u = new URL(window.location.href)
  u.searchParams.delete('preview')
  return u.pathname + u.search + u.hash || '/'
}

/**
 * Lab-only device frames. Only mounted when URL has ?preview=1
 * (or hash #preview). Normal phone/laptop opens never see this chrome.
 */
export default function DevicePreview() {
  const [mode, setModeState] = useState(loadMode)
  const [scale, setScale] = useState(1)

  const setMode = useCallback((id) => {
    setModeState(id)
    saveMode(id)
  }, [])

  const cfg = useMemo(() => MODES.find((m) => m.id === mode) || MODES[0], [mode])

  useEffect(() => {
    if (mode === 'responsive' || !cfg.width) {
      setScale(1)
      return
    }
    const fit = () => {
      const padX = 48
      const padY = 120
      const vw = window.innerWidth
      const vh = window.innerHeight
      const sx = (vw - padX) / cfg.width
      const sy = (vh - padY) / cfg.height
      const s = Math.min(1, sx, sy)
      setScale(Math.max(0.35, Math.round(s * 100) / 100))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [mode, cfg.width, cfg.height])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map = { '1': 'mobile', '2': 'tablet', '3': 'desktop', '4': 'responsive' }
      if (map[e.key]) {
        e.preventDefault()
        setMode(map[e.key])
      }
      if (e.key === 'Escape') {
        window.location.href = exitPreviewUrl()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode])

  const src = useMemo(() => embedSrc(), [])

  if (mode === 'responsive') {
    return (
      <div className="device-preview-root h-full w-full relative">
        <PreviewToolbar mode={mode} onMode={setMode} scale={1} floating />
        <div className="h-full w-full">
          <App />
        </div>
      </div>
    )
  }

  const w = cfg.width
  const h = cfg.height

  return (
    <div className="device-preview-root h-full w-full relative overflow-hidden">
      <div className="device-preview-stage absolute inset-0 flex flex-col">
        <PreviewToolbar mode={mode} onMode={setMode} scale={scale} floating={false} />

        <div className="flex-1 min-h-0 flex items-center justify-center px-3 pb-4" style={{ minHeight: 0 }}>
          <div
            className="device-frame-outer"
            style={{
              width: w * scale,
              height: h * scale,
            }}
          >
            <div
              className={`device-frame ${cfg.bezel ? 'device-frame-bezel' : 'device-frame-flat'} ${
                mode === 'mobile' ? 'device-frame-phone' : mode === 'tablet' ? 'device-frame-tablet' : ''
              }`}
              style={{
                width: w,
                height: h,
                borderRadius: cfg.radius,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {mode === 'mobile' && <div className="device-notch" aria-hidden />}
              <iframe
                title={`WeatherGPT ${cfg.label} preview`}
                src={src}
                className="device-iframe"
                style={{
                  width: w,
                  height: h,
                  borderRadius: Math.max(0, cfg.radius - (cfg.bezel ? 10 : 0)),
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/40 pb-2 shrink-0 tabular-nums">
          Lab preview · {cfg.label} · {cfg.hint}
          {scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}
          <span className="mx-2 opacity-40">·</span>
          1–4 switch · Esc exit
        </p>
      </div>
    </div>
  )
}

function PreviewToolbar({ mode, onMode, scale, floating }) {
  return (
    <div
      className={
        floating
          ? 'fixed top-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none'
          : 'shrink-0 flex justify-center pt-3 pb-2 z-20'
      }
    >
      <div
        className={`pointer-events-auto flex items-center gap-1 p-1 rounded-2xl border border-white/15 bg-[#0c1428]/92 backdrop-blur-xl shadow-2xl shadow-black/40 ${
          floating ? 'scale-95 hover:scale-100 transition' : ''
        }`}
        role="toolbar"
        aria-label="Device preview lab"
      >
        {MODES.map((m) => {
          const Icon = m.icon
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onMode(m.id)}
              title={`${m.label} (${m.hint})`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition focus-ring ${
                active
                  ? 'bg-sky-400 text-white shadow-md shadow-sky-400/30'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{m.label}</span>
              <span className="sm:hidden">{m.short}</span>
            </button>
          )
        })}
        {mode !== 'responsive' && scale < 1 && (
          <span className="hidden md:inline text-[10px] text-white/35 px-2 tabular-nums">
            {Math.round(scale * 100)}%
          </span>
        )}
        <a
          href={exitPreviewUrl()}
          title="Exit lab preview"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

/** Inside framed iframe */
export function isEmbedMode() {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1'
  } catch {
    return false
  }
}

/**
 * Lab switcher only when explicitly requested.
 * ?preview=1  or  #preview
 * Never on normal phone / laptop open.
 */
export function shouldUseDevicePreview() {
  try {
    if (isEmbedMode()) return false
    const q = new URLSearchParams(window.location.search)
    if (q.get('preview') === '1' || q.get('preview') === 'true' || q.get('lab') === '1') {
      return true
    }
    if (typeof window !== 'undefined' && /preview/i.test(window.location.hash || '')) {
      return true
    }
    return false
  } catch {
    return false
  }
}
