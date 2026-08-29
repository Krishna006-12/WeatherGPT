/**
 * Samsung-style 2D weather person — full-body filled SVG.
 * Mood / props follow live weather (umbrella, phone, heat, night lantern…).
 * Improved proportions, shading, and weather FX vs earlier draft.
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

const SKIN = '#F0C7A8'
const SKIN_S = '#E0B090'
const HAIR = '#2C241C'
const SHIRT_A = '#5B9FD4'
const SHIRT_B = '#3D7AB0'
const PANTS = '#2A3548'
const SHOE = '#1A2230'

function WeatherFx({ mood }) {
  if (mood === 'rain' || mood === 'storm') {
    return (
      <g className="wx-svg-rain" aria-hidden>
        {Array.from({ length: mood === 'storm' ? 12 : 8 }, (_, i) => (
          <line
            key={i}
            className="wx-svg-drop"
            x1={28 + ((i * 18) % 150)}
            y1={6 + (i % 4) * 5}
            x2={24 + ((i * 18) % 150)}
            y2={18 + (i % 4) * 5}
            stroke={mood === 'storm' && i % 4 === 0 ? '#FFE566' : '#A8D4F0'}
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{
              animationDelay: `${(i % 5) * 0.11}s`,
              animationDuration: `${0.7 + (i % 3) * 0.12}s`,
            }}
          />
        ))}
        {mood === 'storm' && (
          <path
            className="wx-svg-flash"
            d="M150 6 L138 28 L148 28 L132 54"
            stroke="#FFE566"
            strokeWidth="2.8"
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
        {Array.from({ length: 9 }, (_, i) => (
          <circle
            key={i}
            className="wx-svg-flake"
            cx={30 + ((i * 19) % 140)}
            cy={8 + (i % 3) * 7}
            r={1.6 + (i % 2) * 0.6}
            fill="#fff"
            style={{
              animationDelay: `${(i % 4) * 0.28}s`,
              animationDuration: `${2.2 + (i % 3) * 0.3}s`,
            }}
          />
        ))}
      </g>
    )
  }
  if (mood === 'sunny' || mood === 'hot') {
    return (
      <g aria-hidden>
        <circle cx="158" cy="28" r="16" fill="#FFD24A" className="wx-sun-core" />
        <circle cx="158" cy="28" r="24" fill="rgba(255,210,80,0.28)" className="wx-sun-halo" />
        {mood === 'hot' &&
          [0, 1, 2].map((i) => (
            <path
              key={i}
              className="wx-heat-w"
              d={`M${48 + i * 14} 70 q 4 -10 0 -18`}
              stroke="rgba(255,160,80,0.55)"
              strokeWidth="2"
              fill="none"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
      </g>
    )
  }
  if (mood === 'night' || mood === 'night_clear') {
    return (
      <g aria-hidden>
        <circle cx="156" cy="26" r="13" fill="#EFE8C8" className="wx-moon-core" />
        <circle cx="162" cy="22" r="10" fill="rgba(12,18,32,0.45)" />
        <circle cx="128" cy="14" r="1.5" fill="#fff" className="wx-star" />
        <circle cx="140" cy="10" r="1.1" fill="#fff" className="wx-star" />
        <circle cx="118" cy="22" r="1" fill="#fff" className="wx-star" />
      </g>
    )
  }
  if (mood === 'cloudy' || mood === 'fog' || mood === 'partly') {
    return (
      <g aria-hidden opacity="0.7">
        <ellipse cx="150" cy="26" rx="26" ry="12" fill="rgba(255,255,255,0.55)" className="wx-fog-e" />
        <ellipse cx="136" cy="30" rx="14" ry="8" fill="rgba(255,255,255,0.4)" />
        {mood === 'fog' && (
          <ellipse cx="70" cy="200" rx="40" ry="8" fill="rgba(200,210,220,0.25)" className="wx-fog-e" />
        )}
      </g>
    )
  }
  return null
}

function PersonSvg({ mood, windy }) {
  const wet = mood === 'rain' || mood === 'storm'
  const cold = mood === 'cold' || mood === 'snow'
  const hot = mood === 'hot'
  const night = mood === 'night' || mood === 'night_clear'
  const storm = mood === 'storm'
  const shirt = storm ? '#4A5568' : hot ? '#E8A060' : night ? '#3D4A6B' : SHIRT_A
  const shirtDark = storm ? '#2D3748' : hot ? '#C87840' : night ? '#2A3550' : SHIRT_B

  return (
    <svg
      className={`wx-person-svg ${windy ? 'is-windy' : ''} mood-${mood}`}
      viewBox="0 0 200 260"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <linearGradient id="wxSkin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_S} />
        </linearGradient>
        <linearGradient id="wxShirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shirt} />
          <stop offset="100%" stopColor={shirtDark} />
        </linearGradient>
        <linearGradient id="wxHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A3028" />
          <stop offset="100%" stopColor={HAIR} />
        </linearGradient>
      </defs>

      <WeatherFx mood={mood} />

      {/* ground shadow */}
      <ellipse cx="100" cy="246" rx="48" ry="8" fill="rgba(0,0,0,0.28)" className="wx-shadow" />
      {wet && <ellipse cx="100" cy="248" rx="36" ry="5" fill="rgba(100,160,220,0.25)" className="wx-puddle" />}

      {/* legs */}
      <g>
        <path
          d="M78 168 L72 220 C72 226 80 230 88 226 L92 168 Z"
          fill={PANTS}
          stroke="#1a2030"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M122 168 L128 220 C128 226 120 230 112 226 L108 168 Z"
          fill={PANTS}
          stroke="#1a2030"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <ellipse cx="80" cy="228" rx="14" ry="7" fill={SHOE} />
        <ellipse cx="120" cy="228" rx="14" ry="7" fill={SHOE} />
      </g>

      {/* torso */}
      <g className="wx-torso">
        <path
          d="M68 100
             C60 108 58 150 64 168
             C70 178 86 184 100 184
             C114 184 130 178 136 168
             C142 150 140 108 132 100
             C122 90 78 90 68 100 Z"
          fill="url(#wxShirt)"
          stroke="#1a2030"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* collar */}
        <path d="M88 102 L100 112 L112 102" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />

        {/* left arm */}
        <path
          d="M68 112 C52 122 48 150 58 162 C64 168 74 162 76 152 C78 138 74 120 68 112 Z"
          fill="url(#wxShirt)"
          stroke="#1a2030"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* right arm — holds umbrella or phone */}
        <path
          d="M132 112 C148 122 152 150 142 162 C136 168 126 162 124 152 C122 138 126 120 132 112 Z"
          fill="url(#wxShirt)"
          stroke="#1a2030"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <ellipse cx="58" cy="160" rx="9" ry="8" fill="url(#wxSkin)" stroke="#1a2030" strokeWidth="1.6" />
        <ellipse cx="142" cy="160" rx="9" ry="8" fill="url(#wxSkin)" stroke="#1a2030" strokeWidth="1.6" />

        {cold && (
          <path
            d="M72 108 C90 122 110 122 128 108"
            stroke="#6B8FCE"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            opacity="0.95"
          />
        )}
      </g>

      {/* umbrella */}
      {wet && (
        <g className="wx-umbrella">
          <line x1="42" y1="160" x2="38" y2="70" stroke="#1a2030" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M38 70 C38 70 38 48 14 58 C26 42 38 36 38 36 C38 36 50 42 62 58 C38 48 38 70 38 70 Z"
            fill={storm ? '#4A5568' : '#5B9FD4'}
            stroke="#1a2030"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* phone when clear/partly */}
      {(mood === 'sunny' || mood === 'partly' || mood === 'cloudy') && !wet && (
        <g className="wx-phone">
          <rect x="136" y="148" width="12" height="20" rx="2.5" fill="#1a2030" stroke="#0a1018" strokeWidth="1" />
          <rect x="137.5" y="150" width="9" height="14" rx="1" fill="#7EC8FF" opacity="0.85" />
        </g>
      )}

      {/* lantern at night */}
      {night && (
        <g>
          <line x1="148" y1="150" x2="148" y2="128" stroke="#C4A35A" strokeWidth="2" />
          <rect x="140" y="118" width="16" height="14" rx="2" fill="#FFE566" className="wx-lantern-glow" opacity="0.9" />
          <rect x="140" y="118" width="16" height="14" rx="2" fill="none" stroke="#C4A35A" strokeWidth="1.5" />
        </g>
      )}

      {/* head */}
      <g className="wx-head">
        {/* neck */}
        <rect x="92" y="88" width="16" height="16" rx="4" fill="url(#wxSkin)" />
        {/* hair back */}
        <ellipse cx="100" cy="58" rx="34" ry="30" fill="url(#wxHair)" />
        {/* face */}
        <ellipse cx="100" cy="70" rx="30" ry="32" fill="url(#wxSkin)" stroke="#1a2030" strokeWidth="1.8" />
        {/* hair front bangs */}
        <path
          d="M70 58 C78 42 92 38 100 38 C108 38 122 42 130 58 C120 48 110 46 100 46 C90 46 80 48 70 58 Z"
          fill="url(#wxHair)"
        />
        {/* ears */}
        <ellipse cx="70" cy="72" rx="6" ry="8" fill="url(#wxSkin)" stroke="#1a2030" strokeWidth="1.4" />
        <ellipse cx="130" cy="72" rx="6" ry="8" fill="url(#wxSkin)" stroke="#1a2030" strokeWidth="1.4" />

        {/* eyes */}
        {night ? (
          <g stroke="#1a2030" strokeWidth="2.6" fill="none" strokeLinecap="round">
            <path d="M82 72 Q90 68 98 72" />
            <path d="M102 72 Q110 68 118 72" />
          </g>
        ) : (
          <g>
            <ellipse cx="88" cy="72" rx="5.5" ry="6.5" fill="#fff" stroke="#1a2030" strokeWidth="1.5" />
            <ellipse cx="112" cy="72" rx="5.5" ry="6.5" fill="#fff" stroke="#1a2030" strokeWidth="1.5" />
            <circle cx="89" cy="73" r="2.8" fill="#1a2030" />
            <circle cx="113" cy="73" r="2.8" fill="#1a2030" />
            <circle cx="90.5" cy="71.5" r="1" fill="#fff" />
            <circle cx="114.5" cy="71.5" r="1" fill="#fff" />
            {(storm || hot) && (
              <g stroke="#1a2030" strokeWidth="2.4" strokeLinecap="round">
                <path d="M78 62 L96 66" />
                <path d="M122 62 L104 66" />
              </g>
            )}
          </g>
        )}

        {/* blush */}
        <ellipse cx="78" cy="82" rx="5" ry="3" fill="rgba(255,120,100,0.28)" />
        <ellipse cx="122" cy="82" rx="5" ry="3" fill="rgba(255,120,100,0.28)" />

        {/* smile / mouth */}
        {storm || hot ? (
          <path d="M90 90 Q100 86 110 90" stroke="#1a2030" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : mood === 'sunny' || mood === 'partly' ? (
          <path d="M90 88 Q100 96 110 88" stroke="#1a2030" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : (
          <line x1="92" y1="90" x2="108" y2="90" stroke="#1a2030" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </g>
    </svg>
  )
}

function tipFor(mood, lang) {
  const hi = lang === 'hi'
  const map = {
    rain: hi ? 'छाता ले लो!' : 'Grab an umbrella!',
    storm: hi ? 'अंदर रहो!' : 'Stay inside!',
    snow: hi ? 'गर्म रहो' : 'Bundle up',
    sunny: hi ? 'धूप निकली' : 'Sunny vibes',
    hot: hi ? 'पानी पियो' : 'Drink water',
    cold: hi ? 'गर्म कपड़े' : 'Stay warm',
    fog: hi ? 'सावधानी से' : 'Go careful',
    cloudy: hi ? 'बादल छाए' : 'Cloudy day',
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
      className={`wx-character wx-person mood-${mood} ${windy ? 'is-windy' : ''} ${className}`}
      role="img"
      aria-label={tip}
    >
      <div className="wx-character-stage">
        <PersonSvg mood={mood} windy={windy} />
      </div>
      <p className="wx-character-tip">{tip}</p>
    </div>
  )
}
