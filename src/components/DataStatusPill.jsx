/**
 * Unobtrusive Live / Cached / Offline / Updating pill.
 * Never labels stale or demo data as Live.
 */
import { statusLabels, statusDetail, formatAge } from '../services/networkStatus'

const DOT = {
  live: 'live-dot',
  updating: 'live-dot live-dot-pulse',
  cached: 'live-dot-off',
  offline: 'live-dot-off',
}

const PILL = {
  live: 'pg-live-pill pg-status-live',
  updating: 'pg-live-pill pg-status-updating',
  cached: 'pg-live-pill pg-status-cached',
  offline: 'pg-live-pill pg-status-offline',
}

export default function DataStatusPill({
  status,
  lang = 'en',
  compact = false,
  className = '',
  title,
}) {
  if (!status?.code) return null
  const code = status.code
  const label = status.demo
    ? lang === 'hi'
      ? 'डेमो'
      : 'Demo'
    : statusLabels(code, lang)
  const detail = statusDetail(status, lang)
  const tip =
    title ||
    [
      detail,
      status.demo ? (lang === 'hi' ? 'असली ऑब्ज़र्वेशन नहीं' : 'Not a real observation') : null,
      !status.live && status.ageMs != null
        ? lang === 'hi'
          ? `आयु ${formatAge(status.ageMs, lang)}`
          : `Age ${formatAge(status.ageMs, lang)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <span
      className={`${PILL[code] || PILL.cached} ${className}`.trim()}
      title={tip}
      role="status"
      aria-live="polite"
      data-status={code}
      data-stale={status.stale ? '1' : '0'}
      data-demo={status.demo ? '1' : '0'}
    >
      <span className={DOT[code] || DOT.cached} aria-hidden />
      <span className="pg-status-label">{label}</span>
      {!compact && detail ? (
        <span className="text-white/40 pg-status-detail">· {detail}</span>
      ) : compact && status.ageMs != null && code !== 'live' ? (
        <span className="text-white/40 pg-status-detail">· {formatAge(status.ageMs, lang)}</span>
      ) : compact && code === 'live' && status.ageMs != null ? (
        <span className="text-white/40 pg-status-detail">· {formatAge(status.ageMs, lang)}</span>
      ) : null}
    </span>
  )
}

/** Banner when offline or very stale — still unobtrusive */
export function DataStatusBanner({ status, lang = 'en', onRetry }) {
  if (!status || (status.code === 'live' && !status.demo)) return null
  if (status.code === 'updating' && !status.stale) return null

  const show =
    status.code === 'offline' ||
    status.demo ||
    (status.stale && status.code === 'cached') ||
    status.code === 'offline'

  if (!show && status.code !== 'cached') return null
  // Only banner for offline / demo / clearly stale cached
  if (status.code === 'cached' && !status.stale && !status.demo) return null

  let text
  if (status.demo) {
    text =
      lang === 'hi'
        ? 'डेमो फ़ॉलबैक — नेटवर्क/कैश उपलब्ध नहीं। लाइव मौसम नहीं।'
        : 'Demo fallback — no network/cache. Not live weather.'
  } else if (status.code === 'offline') {
    text =
      lang === 'hi'
        ? `ऑफ़लाइन · कैश दिखा रहे हैं (${statusDetail(status, lang)})`
        : `Offline · showing cached forecast (${statusDetail(status, lang)})`
  } else {
    text =
      lang === 'hi'
        ? `कैश डेटा · ${statusDetail(status, lang)} — लाइव नहीं`
        : `Cached data · ${statusDetail(status, lang)} — not live`
  }

  return (
    <div
      className="wx-status-banner"
      role="status"
      data-status={status.code}
    >
      <span className="wx-status-banner-text">{text}</span>
      {onRetry && status.code !== 'offline' ? (
        <button type="button" className="wx-status-banner-btn" onClick={onRetry}>
          {lang === 'hi' ? 'रीफ़्रेश' : 'Refresh'}
        </button>
      ) : null}
      {onRetry && status.code === 'offline' ? (
        <button type="button" className="wx-status-banner-btn" onClick={onRetry}>
          {lang === 'hi' ? 'फिर कोशिश' : 'Retry'}
        </button>
      ) : null}
    </div>
  )
}
