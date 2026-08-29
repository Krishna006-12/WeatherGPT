/**
 * Gray chibi cat mascot — matched to user reference sheet.
 * Front-facing: yellow eyes, white belly, forehead stripes, curved tail.
 * Weather only tweaks expression + light FX (keeps silhouette stable).
 */

import { useMemo } from 'react'

export function characterScene(weather) {
  const c = weather?.current || {}
  const icon = String(c.icon || '').toLowerCase()
  const cond = String(c.condition || c.condition_hi || '').toLowerCase()
  const night = c.isDay === false
  const temp = Number(c.temp)
  const feels = Number(c.feelsLike ?? c.temp)
  const wind = Number(c.wind || 0)
  const pop = Number(weather?.daily?.[0]?.pop ?? 0)
  const code = Number(c.code || 0)

  const storm =
    icon.includes('lightning') ||
    icon.includes('storm') ||
    code >= 95 ||
    /thunder|storm|hail|तूफान|गर्ज|आंधी/.test(cond)
  const rain =
    !storm &&
    (icon.includes('rain') ||
      icon.includes('drizzle') ||
      (code >= 51 && code < 70) ||
      (code >= 80 && code < 90) ||
      /rain|drizzle|shower|बारिश|बौछ|फुहार/.test(cond) ||
      pop >= 65)
  const fog = icon.includes('fog') || /fog|mist|haze|कोहरा|धुंध/.test(cond)
  const snow = icon.includes('snow') || /snow|sleet|बर्फ/.test(cond)
  const clear = icon === 'sun' || code === 0 || code === 1 || /clear|sunny|साफ|साफ़/.test(cond)
  const cloudy =
    icon.includes('cloud') || code === 2 || code === 3 || /cloud|overcast|बादल/.test(cond)

  if (storm) return { mood: 'storm', night, windy: wind >= 25 }
  if (snow) return { mood: 'snow', night, windy: wind >= 22 }
  if (rain) return { mood: 'rain', night, windy: wind >= 25 }
  if (fog) return { mood: 'fog', night, windy: false }
  if (night && clear) return { mood: 'night_clear', night: true, windy: wind >= 28 }
  if (night) return { mood: 'night', night: true, windy: wind >= 28 }
  if (!Number.isNaN(feels) && feels >= 38) return { mood: 'hot', night: false, windy: wind >= 22 }
  if (!Number.isNaN(temp) && temp <= 8) return { mood: 'cold', night: false, windy: wind >= 22 }
  if (clear) return { mood: 'sunny', night: false, windy: wind >= 28 }
  if (cloudy) return { mood: 'cloudy', night: false, windy: wind >= 25 }
  return { mood: 'partly', night: false, windy: wind >= 25 }
}

/* Exact reference colors */
const INK = '#1E1E1E'
const FUR = '#8B8B8B'
const FUR2 = '#757575'
const FUR3 = '#9A9A9A'
const BELLY = '#F2F2F2'
const EYE = '#F2E11A'
const NOSE = '#E8919C'
const SH = 'rgba(90,90,90,0.22)'

function Fx({ mood }) {
  if (mood === 'rain' || mood === 'storm') {
    return (
      <g className="wx-svg-rain" aria-hidden>
        {Array.from({ length: mood === 'storm' ? 10 : 7 }, (_, i) => (
          <line
            key={i}
            className="wx-svg-drop"
            x1={30 + ((i * 22) % 140)}
            y1={8 + (i % 3) * 6}
            x2={28 + ((i * 22) % 140)}
            y2={20 + (i % 3) * 6}
            stroke={mood === 'storm' && i % 3 === 0 ? '#FFE566' : '#8EC0E8'}
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{
              animationDelay: `${(i % 5) * 0.12}s`,
              animationDuration: `${0.75 + (i % 3) * 0.1}s`,
            }}
          />
        ))}
        {mood === 'storm' && (
          <path
            className="wx-svg-flash"
            d="M125 8 L116 30 L124 30 L112 52"
            stroke="#FFE566"
            strokeWidth="2.6"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </g>
    )
  }
  if (mood === 'snow') {
    return (
      <g aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <circle
            key={i}
            className="wx-svg-flake"
            cx={32 + ((i * 20) % 130)}
            cy={10 + (i % 3) * 8}
            r={1.7 + (i % 2) * 0.5}
            fill="#fff"
            style={{
              animationDelay: `${(i % 4) * 0.3}s`,
              animationDuration: `${2.4 + (i % 3) * 0.25}s`,
            }}
          />
        ))}
      </g>
    )
  }
  if (mood === 'sunny' || mood === 'hot') {
    return (
      <g className="wx-svg-sun" aria-hidden>
        <circle cx="158" cy="26" r="14" fill="#FFD24A" className="wx-sun-core" />
        <circle cx="158" cy="26" r="20" fill="rgba(255,210,80,0.25)" className="wx-sun-halo" />
      </g>
    )
  }
  if (mood === 'night' || mood === 'night_clear') {
    return (
      <g className="wx-svg-night" aria-hidden>
        <circle cx="156" cy="24" r="12" fill="#EFE8C8" className="wx-moon-core" />
        <circle cx="162" cy="20" r="9" fill="rgba(18,24,40,0.35)" />
        <circle cx="130" cy="14" r="1.4" fill="#fff" className="wx-star" />
        <circle cx="142" cy="10" r="1" fill="#fff" className="wx-star" />
      </g>
    )
  }
  if (mood === 'cloudy' || mood === 'fog' || mood === 'partly') {
    return (
      <g aria-hidden opacity="0.55">
        <ellipse cx="148" cy="24" rx="22" ry="10" fill="rgba(255,255,255,0.5)" />
        <ellipse cx="136" cy="28" rx="12" ry="7" fill="rgba(255,255,255,0.4)" />
      </g>
    )
  }
  return null
}

/**
 * Reference front cat — proportions locked to the sheet.
 * Canvas: 200×230. Character centered.
 */
function RefCat({ mood, windy }) {
  const mad = mood === 'storm' || mood === 'hot'
  const sleepy = mood === 'night' || mood === 'night_clear'
  const smile = mood === 'sunny' || mood === 'partly'
  const wet = mood === 'rain' || mood === 'storm'
  const cold = mood === 'cold' || mood === 'snow'

  return (
    <svg
      className={`wx-person-svg wx-cat-svg ${windy ? 'is-windy' : ''} mood-${mood}`}
      viewBox="0 0 200 230"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      <Fx mood={mood} />

      {/* floor shadow */}
      <ellipse cx="100" cy="218" rx="52" ry="9" fill={SH} className="wx-shadow" />

      {/* ── TAIL (front-view curve to the right, like reference) ── */}
      <g className="wx-cat-tail">
        <path
          d="M132 148
             C162 140 176 155 172 178
             C168 198 150 204 144 192
             C140 182 146 168 134 158
             C132 154 130 150 132 148 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      </g>

      {/* ── LEGS + FEET ── */}
      <g>
        {/* left leg */}
        <path
          d="M74 175
             L70 202
             C70 208 78 210 84 206
             L88 175 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* right leg */}
        <path
          d="M112 175
             L116 202
             C116 208 124 210 130 206
             L126 175 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* feet */}
        <ellipse cx="78" cy="206" rx="13" ry="8" fill={FUR3} stroke={INK} strokeWidth="3" />
        <ellipse cx="122" cy="206" rx="13" ry="8" fill={FUR3} stroke={INK} strokeWidth="3" />
      </g>

      {/* ── BODY ── */}
      <g className="wx-torso">
        <path
          d="M64 100
             C56 112 54 145 60 172
             C66 190 80 198 100 198
             C120 198 134 190 140 172
             C146 145 144 112 136 100
             C126 88 74 88 64 100 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* white belly — large oval like reference */}
        <ellipse cx="100" cy="148" rx="30" ry="40" fill={BELLY} stroke={INK} strokeWidth="2.4" />
        {/* belly squiggle mark */}
        <path
          d="M96 140
             C94 150 98 160 96 168
             M96 152 C100 148 104 152 100 156"
          stroke={INK}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.65"
        />

        {/* left arm */}
        <path
          d="M64 115
             C48 128 46 155 58 168
             C64 174 74 168 76 158
             C78 142 72 124 64 115 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.3"
          strokeLinejoin="round"
        />
        {/* right arm */}
        <path
          d="M136 115
             C152 128 154 155 142 168
             C136 174 126 168 124 158
             C122 142 128 124 136 115 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.3"
          strokeLinejoin="round"
        />
        {/* paws */}
        <ellipse cx="58" cy="164" rx="9" ry="8" fill={FUR3} stroke={INK} strokeWidth="2.5" />
        <ellipse cx="142" cy="164" rx="9" ry="8" fill={FUR3} stroke={INK} strokeWidth="2.5" />
      </g>

      {/* optional thin scarf — doesn't hide silhouette */}
      {cold && (
        <path
          d="M72 108 C92 120 108 120 128 108"
          stroke="#5A8FD0"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}

      {/* ── HEAD ── */}
      <g className="wx-head">
        {/* ears — tall triangles */}
        <path
          d="M58 82 L70 32 L96 72 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.3"
          strokeLinejoin="round"
        />
        <path d="M72 70 L78 44 L90 66 Z" fill={FUR2} />
        <path
          d="M142 82 L130 32 L104 72 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.3"
          strokeLinejoin="round"
        />
        <path d="M128 70 L122 44 L110 66 Z" fill={FUR2} />

        {/* head block — slightly boxy rounded square like reference */}
        <path
          d="M52 86
             C52 56 72 46 100 46
             C128 46 148 56 148 86
             C148 112 130 126 100 126
             C70 126 52 112 52 86 Z"
          fill={FUR}
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* 3 forehead stripes */}
        <path d="M86 56 C88 66 86 76 87 82" stroke={FUR2} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M100 54 C100 66 100 76 100 84" stroke={FUR2} strokeWidth="4.2" fill="none" strokeLinecap="round" />
        <path d="M114 56 C112 66 114 76 113 82" stroke={FUR2} strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* EYES */}
        {sleepy ? (
          <g stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round">
            <path d="M70 90 Q82 84 94 90" />
            <path d="M106 90 Q118 84 130 90" />
          </g>
        ) : (
          <g>
            {/* yellow eye shapes — almond / big like reference */}
            <path
              d="M66 92
                 C66 80 76 74 86 74
                 C96 74 100 82 100 92
                 C100 102 94 108 86 108
                 C76 108 66 102 66 92 Z"
              fill={EYE}
              stroke={INK}
              strokeWidth="3"
            />
            <path
              d="M100 92
                 C100 80 110 74 120 74
                 C130 74 134 82 134 92
                 C134 102 128 108 120 108
                 C110 108 100 102 100 92 Z"
              fill={EYE}
              stroke={INK}
              strokeWidth="3"
            />
            {/* pupils */}
            <ellipse cx="84" cy="93" rx={mad ? 3.5 : 4.2} ry={mad ? 6 : 7.2} fill={INK} />
            <ellipse cx="118" cy="93" rx={mad ? 3.5 : 4.2} ry={mad ? 6 : 7.2} fill={INK} />
            {/* shine dots */}
            <circle cx="87" cy="88" r="2" fill="#fff" />
            <circle cx="121" cy="88" r="2" fill="#fff" />
            {mad && (
              <g stroke={INK} strokeWidth="3" strokeLinecap="round">
                <path d="M66 76 L92 82" />
                <path d="M134 76 L108 82" />
              </g>
            )}
          </g>
        )}

        {/* nose — small pink triangle */}
        <path
          d="M100 102 L95 108 Q100 111 105 108 Z"
          fill={NOSE}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* mouth */}
        {mad ? (
          <path d="M90 116 Q100 110 110 116" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        ) : smile ? (
          <path d="M90 114 Q100 122 110 114" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        ) : (
          /* flat line — exact reference vibe */
          <line x1="90" y1="116" x2="110" y2="116" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        )}

        {wet && (
          <path
            d="M132 100 q-1 5 0 9"
            stroke="#7EB4E0"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </g>

      {/* tiny umbrella only in rain — side prop, thin */}
      {wet && (
        <g className="wx-umbrella">
          <line x1="40" y1="160" x2="36" y2="72" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path
            d="M36 72 C36 72 36 54 16 62 C26 48 36 44 36 44 C36 44 46 48 56 62 C36 54 36 72 36 72 Z"
            fill={mood === 'storm' ? '#4A5568' : '#5B8FD4'}
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  )
}

function tipFor(mood, lang) {
  const hi = lang === 'hi'
  const map = {
    rain: hi ? 'छाता ले लो!' : 'Grab an umbrella!',
    storm: hi ? 'अंदर रहो!' : 'Stay inside!',
    snow: hi ? 'गर्म रहो' : 'Bundle up',
    sunny: hi ? 'धूप निकली' : 'Sunny day',
    hot: hi ? 'पानी पियो' : 'Drink water',
    cold: hi ? 'गर्म कपड़े' : 'Stay warm',
    fog: hi ? 'सावधानी से' : 'Go careful',
    cloudy: hi ? 'बादल' : 'Cloudy',
    partly: hi ? 'मिली-जुली धूप' : 'Mixed skies',
    night: hi ? 'शुभ रात्रि' : 'Good night',
    night_clear: hi ? 'तारों भरी रात' : 'Starry night',
  }
  return map[mood] || (hi ? 'मौसम' : 'Weather')
}

export default function WeatherCharacter({ weather, lang = 'en', className = '' }) {
  const scene = useMemo(
    () => characterScene(weather),
    [
      weather?.current?.icon,
      weather?.current?.condition,
      weather?.current?.condition_hi,
      weather?.current?.isDay,
      weather?.current?.temp,
      weather?.current?.feelsLike,
      weather?.current?.wind,
      weather?.current?.code,
      weather?.daily?.[0]?.pop,
      weather?.fetchedAt,
    ],
  )

  const { mood, windy } = scene
  const tip = tipFor(mood, lang)

  return (
    <div
      className={`wx-character wx-cat mood-${mood} ${windy ? 'is-windy' : ''} ${className}`}
      role="img"
      aria-label={tip}
    >
      <div className="wx-character-stage">
        <RefCat mood={mood} windy={windy} />
      </div>
      <p className="wx-character-tip">{tip}</p>
    </div>
  )
}
