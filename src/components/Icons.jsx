/**
 * Soft “3D” weather glyphs — Apple Weather–inspired depth (pure SVG)
 * + light micro-motion wrappers (CSS classes; reduced-motion safe).
 */

function wrap(name, className, svg) {
  const motion =
    name === 'sun'
      ? 'wx-icon-sun'
      : name === 'cloud-rain' || name === 'cloud-drizzle'
        ? 'wx-icon-rain'
        : name === 'cloud-lightning'
          ? 'wx-icon-storm'
          : name === 'wind'
            ? 'wx-icon-wind'
            : ''
  return <span className={`wx-icon ${motion} ${className}`.trim()}>{svg}</span>
}

export function WeatherIcon({ name, className = 'w-7 h-7', sun = false }) {
  const cn = 'w-full h-full'
  const box = className

  switch (name) {
    case 'sun':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <defs>
            <radialGradient id="sunCore" cx="40%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#FFF8D6" />
              <stop offset="55%" stopColor="#FFD60A" />
              <stop offset="100%" stopColor="#FF9F0A" />
            </radialGradient>
            <filter id="sunGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#sunGlow)" opacity="0.95">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect
                key={a}
                x="30"
                y="4"
                width="4"
                height="10"
                rx="2"
                fill="#FFD60A"
                transform={`rotate(${a} 32 32)`}
                opacity="0.9"
              />
            ))}
            <circle cx="32" cy="32" r="14" fill="url(#sunCore)" />
            <circle cx="27" cy="27" r="5" fill="white" opacity="0.35" />
          </g>
        </svg>
      )
    case 'cloud-sun':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <defs>
            <radialGradient id="csSun" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#FFF6C8" />
              <stop offset="100%" stopColor="#FFD60A" />
            </radialGradient>
            <linearGradient id="csCloud" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D0E4F7" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="22" r="12" fill="url(#csSun)" />
          <circle cx="37" cy="18" r="4" fill="white" opacity="0.35" />
          <ellipse cx="28" cy="40" rx="18" ry="12" fill="url(#csCloud)" />
          <ellipse cx="40" cy="38" rx="14" ry="11" fill="url(#csCloud)" />
          <ellipse cx="20" cy="42" rx="10" ry="8" fill="#E8F4FF" />
          <ellipse cx="32" cy="34" rx="8" ry="5" fill="white" opacity="0.55" />
        </svg>
      )
    case 'cloud':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <defs>
            <linearGradient id="cl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#C5D9EE" />
            </linearGradient>
          </defs>
          <ellipse cx="30" cy="36" rx="20" ry="14" fill="url(#cl)" />
          <ellipse cx="42" cy="34" rx="15" ry="12" fill="url(#cl)" />
          <ellipse cx="20" cy="38" rx="12" ry="10" fill="#DCEAF8" />
          <ellipse cx="34" cy="30" rx="10" ry="6" fill="white" opacity="0.5" />
        </svg>
      )
    case 'cloud-rain':
    case 'cloud-drizzle':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <defs>
            <linearGradient id="cr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F4FAFF" />
              <stop offset="100%" stopColor="#A8C8E8" />
            </linearGradient>
          </defs>
          <ellipse cx="30" cy="28" rx="18" ry="12" fill="url(#cr)" />
          <ellipse cx="40" cy="26" rx="13" ry="10" fill="url(#cr)" />
          <ellipse cx="22" cy="30" rx="10" ry="8" fill="#C5DCF0" />
          <path
            className="rain-drop"
            d="M22 42c0 4-3 8-3 10"
            stroke="#5AC8FA"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ animationDelay: '0s' }}
          />
          <path
            className="rain-drop"
            d="M32 40c0 5-3 9-3 12"
            stroke="#5AC8FA"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ animationDelay: '0.2s' }}
          />
          <path
            className="rain-drop"
            d="M42 42c0 4-3 8-3 10"
            stroke="#5AC8FA"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ animationDelay: '0.35s' }}
          />
        </svg>
      )
    case 'cloud-lightning':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <defs>
            <linearGradient id="cst" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8EEF6" />
              <stop offset="100%" stopColor="#8FA3B8" />
            </linearGradient>
            <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFE566" />
              <stop offset="100%" stopColor="#FF9F0A" />
            </linearGradient>
          </defs>
          <ellipse cx="30" cy="26" rx="18" ry="12" fill="url(#cst)" />
          <ellipse cx="40" cy="24" rx="13" ry="10" fill="url(#cst)" />
          <ellipse cx="22" cy="28" rx="10" ry="8" fill="#B0C0D0" />
          <path
            d="M34 32L26 44h8l-4 14 16-18h-9l5-8z"
            fill="url(#bolt)"
            stroke="#FFD60A"
            strokeWidth="0.5"
          />
          <ellipse cx="30" cy="22" rx="7" ry="4" fill="white" opacity="0.35" />
        </svg>
      )
    case 'cloud-fog':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <ellipse cx="32" cy="26" rx="18" ry="11" fill="#D8E2EC" opacity="0.9" />
          <ellipse cx="40" cy="24" rx="12" ry="9" fill="#E8EEF4" />
          <rect x="14" y="40" width="36" height="3.5" rx="1.75" fill="#C5D0DC" opacity="0.85" />
          <rect x="18" y="47" width="28" height="3" rx="1.5" fill="#C5D0DC" opacity="0.65" />
          <rect x="20" y="53" width="24" height="2.5" rx="1.25" fill="#C5D0DC" opacity="0.45" />
        </svg>
      )
    case 'snow':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <ellipse cx="30" cy="26" rx="16" ry="11" fill="#E8F2FA" />
          <ellipse cx="40" cy="24" rx="12" ry="9" fill="#F4FAFF" />
          <circle cx="24" cy="44" r="2.5" fill="#A8D4F0" />
          <circle cx="34" cy="48" r="2.5" fill="#A8D4F0" />
          <circle cx="42" cy="43" r="2" fill="#A8D4F0" />
          <path
            d="M32 38v16M26 42l12 8M38 42L26 50"
            stroke="#7EB8E0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'wind':
      return wrap(
        name,
        box,
        <svg className={cn} viewBox="0 0 64 64" fill="none" aria-hidden>
          <path
            d="M10 24h32a8 8 0 1 0-8-8"
            stroke="#8ec8ff"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M10 34h40a6 6 0 1 1-6 6"
            stroke="#c5e0ff"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M10 44h22a5 5 0 1 1-5 5"
            stroke="#8ec8ff"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.75"
          />
        </svg>
      )
    default:
      return sun ? (
        <WeatherIcon name="sun" className={box} />
      ) : (
        <WeatherIcon name="cloud-sun" className={box} />
      )
  }
}

export function SeverityDot({ severity, className = '' }) {
  const colors = {
    red: 'bg-alert-red',
    amber: 'bg-alert-amber',
    yellow: 'bg-sun-400',
    green: 'bg-mint-400',
  }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[severity] || colors.green} ${className}`}
    />
  )
}
