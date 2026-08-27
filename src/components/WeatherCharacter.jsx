/**
 * Samsung Weather–style 2D person that reacts to live conditions.
 * Pure SVG + CSS — no image assets, snappy, theme-aware.
 */

import { useMemo } from 'react'

/** Map weather → scene mood for character + props */
export function characterScene(weather) {
  const c = weather?.current || {}
  const icon = String(c.icon || '').toLowerCase()
  const cond = String(c.condition || '').toLowerCase()
  const night = c.isDay === false
  const temp = Number(c.temp)
  const feels = Number(c.feelsLike ?? c.temp)
  const wind = Number(c.wind || 0)
  const pop = Number(weather?.daily?.[0]?.pop ?? 0)

  const storm =
    icon.includes('lightning') ||
    icon.includes('storm') ||
    /thunder|storm|hail|तूफान|गर्ज/.test(cond)
  const rain =
    !storm &&
    (icon.includes('rain') ||
      icon.includes('drizzle') ||
      /rain|drizzle|shower|बारिश|बौछ/.test(cond) ||
      pop >= 70)
  const fog = icon.includes('fog') || /fog|mist|haze|कोहरा|धुंध/.test(cond)
  const snow = icon.includes('snow') || /snow|sleet|बर्फ/.test(cond)
  const clear = icon === 'sun' || /clear|sunny|साफ|साफ़/.test(cond)
  const cloudy = icon.includes('cloud') || /cloud|overcast|बादल/.test(cond)

  if (storm) return { mood: 'storm', night, windy: wind >= 28 }
  if (snow) return { mood: 'snow', night, windy: wind >= 25 }
  if (rain) return { mood: 'rain', night, windy: wind >= 28 }
  if (fog) return { mood: 'fog', night, windy: false }
  if (night && clear) return { mood: 'night_clear', night: true, windy: wind >= 30 }
  if (night) return { mood: 'night', night: true, windy: wind >= 30 }
  if (!Number.isNaN(feels) && feels >= 38) return { mood: 'hot', night: false, windy: wind >= 25 }
  if (!Number.isNaN(temp) && temp <= 8) return { mood: 'cold', night: false, windy: wind >= 25 }
  if (clear) return { mood: 'sunny', night: false, windy: wind >= 30 }
  if (cloudy) return { mood: 'cloudy', night: false, windy: wind >= 28 }
  return { mood: 'partly', night: false, windy: wind >= 28 }
}

function SceneFX({ mood, windy }) {
  if (mood === 'rain' || mood === 'storm') {
    return (
      <div className="wx-fx wx-fx-rain" aria-hidden>
        {Array.from({ length: mood === 'storm' ? 14 : 10 }, (_, i) => (
          <span
            key={i}
            className={mood === 'storm' && i % 5 === 0 ? 'wx-drop is-bolt' : 'wx-drop'}
            style={{
              left: `${(i * 17 + 5) % 92}%`,
              animationDelay: `${(i % 7) * 0.12}s`,
              animationDuration: `${0.7 + (i % 4) * 0.12}s`,
            }}
          />
        ))}
      </div>
    )
  }
  if (mood === 'snow') {
    return (
      <div className="wx-fx wx-fx-snow" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className="wx-flake"
            style={{
              left: `${(i * 13 + 8) % 90}%`,
              animationDelay: `${(i % 6) * 0.35}s`,
              animationDuration: `${2.4 + (i % 5) * 0.4}s`,
            }}
          />
        ))}
      </div>
    )
  }
  if (mood === 'sunny' || mood === 'hot') {
    return (
      <div className="wx-fx wx-fx-sun" aria-hidden>
        <span className="wx-sun-disc" />
        <span className="wx-sun-ray r1" />
        <span className="wx-sun-ray r2" />
        <span className="wx-sun-ray r3" />
      </div>
    )
  }
  if (mood === 'night_clear' || mood === 'night') {
    return (
      <div className="wx-fx wx-fx-night" aria-hidden>
        <span className="wx-moon" />
        <span className="wx-star s1" />
        <span className="wx-star s2" />
        <span className="wx-star s3" />
      </div>
    )
  }
  if (mood === 'fog') {
    return (
      <div className="wx-fx wx-fx-fog" aria-hidden>
        <span className="wx-fog-band b1" />
        <span className="wx-fog-band b2" />
      </div>
    )
  }
  if (windy) {
    return (
      <div className="wx-fx wx-fx-wind" aria-hidden>
        <span className="wx-gust g1" />
        <span className="wx-gust g2" />
        <span className="wx-gust g3" />
      </div>
    )
  }
  return null
}

/** Shared body proportions — Samsung flat 2D look */
function PersonSVG({ mood, windy }) {
  const coat =
    mood === 'rain' || mood === 'storm' || mood === 'snow' || mood === 'cold'
      ? '#2a6f8f'
      : mood === 'hot'
        ? '#e8a54b'
        : mood === 'night' || mood === 'night_clear'
          ? '#3d4f7a'
          : '#4a7fb5'
  const pants =
    mood === 'hot' ? '#c4a574' : mood === 'cold' || mood === 'snow' ? '#2c3a52' : '#5c6b7a'
  const boots =
    mood === 'rain' || mood === 'storm' || mood === 'snow' ? '#1a2433' : '#3d4a5c'
  const skin = '#c9956c'
  const hair = '#2a1f18'

  const umbrella = mood === 'rain' || mood === 'storm'
  const scarf = mood === 'cold' || mood === 'snow'
  const sunglasses = mood === 'sunny' || mood === 'hot'
  const phone = mood === 'cloudy' || mood === 'partly' || mood === 'fog'
  const lantern = mood === 'night' || mood === 'night_clear'

  return (
    <svg
      className={`wx-person-svg ${windy ? 'is-windy' : ''} mood-${mood}`}
      viewBox="0 0 160 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* ground puddle / shadow */}
      <ellipse
        cx="80"
        cy="208"
        rx={umbrella ? 42 : 34}
        ry="7"
        fill={umbrella ? 'rgba(80,140,200,0.35)' : 'rgba(0,0,0,0.22)'}
        className="wx-shadow"
      />
      {umbrella && (
        <ellipse cx="78" cy="210" rx="18" ry="3.5" fill="rgba(100,170,230,0.45)" className="wx-puddle" />
      )}

      {/* legs */}
      <g className="wx-legs">
        <path d="M68 148 L62 198" stroke={pants} strokeWidth="14" strokeLinecap="round" />
        <path d="M92 148 L98 198" stroke={pants} strokeWidth="14" strokeLinecap="round" />
        <path d="M52 198 L70 198" stroke={boots} strokeWidth="11" strokeLinecap="round" />
        <path d="M90 198 L108 198" stroke={boots} strokeWidth="11" strokeLinecap="round" />
      </g>

      {/* torso / coat */}
      <g className="wx-torso">
        <path
          d="M52 78 C52 78 48 145 55 148 L105 148 C112 145 108 78 108 78 C100 72 60 72 52 78Z"
          fill={coat}
        />
        {/* hoodie / collar */}
        {(mood === 'rain' || mood === 'storm' || mood === 'cold' || mood === 'snow') && (
          <path
            d="M58 78 C62 62 98 62 102 78 L96 86 C90 76 70 76 64 86Z"
            fill={coat}
            opacity="0.95"
          />
        )}
        {/* bag strap */}
        {(umbrella || phone) && (
          <path d="M108 95 Q130 120 112 150" stroke="#1e3a4a" strokeWidth="5" fill="none" />
        )}
        {(umbrella || phone) && (
          <path
            d="M108 145 C108 145 128 148 126 168 C124 178 108 176 108 165Z"
            fill="#1e3a4a"
          />
        )}
      </g>

      {/* arms */}
      <g className="wx-arms">
        {umbrella ? (
          <>
            {/* left arm holding umbrella shaft */}
            <path d="M58 95 C40 110 48 140 70 132" stroke={coat} strokeWidth="13" strokeLinecap="round" />
            {/* right arm relaxed */}
            <path d="M102 95 C118 115 112 145 98 148" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            {/* umbrella shaft */}
            <g className="wx-umbrella">
              <path d="M70 132 L70 48" stroke="#1a2433" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M70 48 Q70 28 48 42 Q70 18 92 42 Q70 28 70 48" fill="#1a2a40" />
              <path d="M48 42 Q70 28 92 42" stroke="#0d1520" strokeWidth="2" fill="none" />
              {/* handle curve */}
              <path d="M70 132 Q62 142 68 148" stroke="#1a2433" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            </g>
          </>
        ) : sunglasses && !scarf ? (
          <>
            {/* arms slightly out — relaxed sunny */}
            <path d="M55 95 C38 120 42 150 58 152" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            <path d="M105 95 C122 120 118 150 102 152" stroke={coat} strokeWidth="12" strokeLinecap="round" />
          </>
        ) : phone ? (
          <>
            <path d="M55 95 C40 118 48 148 62 150" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            <path d="M105 92 C120 100 118 120 108 128" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            {/* phone */}
            <rect x="100" y="118" width="14" height="22" rx="2.5" fill="#1a2433" className="wx-phone" />
            <rect x="102" y="121" width="10" height="14" rx="1" fill="#4a9fd8" opacity="0.7" />
          </>
        ) : lantern ? (
          <>
            <path d="M55 95 C40 118 48 148 62 150" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            <path d="M105 95 C122 110 118 140 100 145" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            <g className="wx-lantern">
              <rect x="92" y="145" width="16" height="20" rx="2" fill="#e8c86a" opacity="0.9" />
              <path d="M100 145 L100 138" stroke="#c9a84a" strokeWidth="2" />
              <circle cx="100" cy="155" r="4" fill="#fff6c8" className="wx-lantern-glow" />
            </g>
          </>
        ) : (
          <>
            <path d="M55 95 C40 120 44 150 60 152" stroke={coat} strokeWidth="12" strokeLinecap="round" />
            <path d="M105 95 C120 120 116 150 100 152" stroke={coat} strokeWidth="12" strokeLinecap="round" />
          </>
        )}
      </g>

      {/* scarf */}
      {scarf && (
        <g className="wx-scarf">
          <path d="M62 88 Q80 100 98 88" stroke="#c45c4a" strokeWidth="10" strokeLinecap="round" />
          <path d="M88 94 L92 130" stroke="#c45c4a" strokeWidth="8" strokeLinecap="round" />
        </g>
      )}

      {/* head */}
      <g className="wx-head">
        <circle cx="80" cy="58" r="22" fill={skin} />
        {/* hair */}
        <path
          d="M58 55 C58 38 102 38 102 55 C98 48 90 46 80 46 C70 46 62 48 58 55Z"
          fill={hair}
        />
        {(mood === 'rain' || mood === 'storm' || mood === 'cold' || mood === 'snow') && (
          /* hood fringe */
          <path d="M58 52 C62 42 98 42 102 52" stroke={coat} strokeWidth="6" fill="none" opacity="0.5" />
        )}
        {/* face */}
        {sunglasses ? (
          <g>
            <rect x="66" y="56" width="12" height="7" rx="2" fill="#1a2433" />
            <rect x="82" y="56" width="12" height="7" rx="2" fill="#1a2433" />
            <path d="M78 59 H82" stroke="#1a2433" strokeWidth="1.5" />
          </g>
        ) : (
          <g>
            <circle cx="72" cy="58" r="2.2" fill="#2a1f18" />
            <circle cx="88" cy="58" r="2.2" fill="#2a1f18" />
            {/* smile / concern */}
            {mood === 'storm' || mood === 'hot' ? (
              <path d="M74 68 Q80 64 86 68" stroke="#8a5a40" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M74 66 Q80 72 86 66" stroke="#8a5a40" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            )}
          </g>
        )}
      </g>

      {/* steam / heat waves for hot */}
      {mood === 'hot' && (
        <g className="wx-heat" opacity="0.55">
          <path d="M48 100 Q44 90 48 80" stroke="#ffb84d" strokeWidth="2" fill="none" className="wx-heat-w" />
          <path d="M112 100 Q116 90 112 80" stroke="#ffb84d" strokeWidth="2" fill="none" className="wx-heat-w" />
        </g>
      )}
    </svg>
  )
}

function tipFor(mood, lang) {
  const hi = lang === 'hi'
  const map = {
    rain: hi ? 'छाता ले लो!' : 'Grab an umbrella!',
    storm: hi ? 'अंदर रहें — तूफ़ान' : 'Stay indoors — storms',
    snow: hi ? 'गर्म कपड़े पहनें' : 'Bundle up',
    sunny: hi ? 'धूप का मज़ा लो' : 'Enjoy the sunshine',
    hot: hi ? 'पानी पिएं · छाया' : 'Hydrate · find shade',
    cold: hi ? 'गर्म रखें' : 'Stay warm',
    fog: hi ? 'सावधानी से चलें' : 'Drive carefully',
    cloudy: hi ? 'हल्का बादल' : 'Soft cloud cover',
    partly: hi ? 'मिली-जुली धूप' : 'Mixed skies',
    night: hi ? 'अच्छी रात' : 'Quiet night',
    night_clear: hi ? 'तारों भरी रात' : 'Clear night sky',
  }
  return map[mood] || (hi ? 'मौसम अपडेट' : 'Weather update')
}

/**
 * @param {{ weather: object, lang?: string, className?: string }} props
 */
export default function WeatherCharacter({ weather, lang = 'en', className = '' }) {
  const scene = useMemo(() => characterScene(weather), [
    weather?.current?.icon,
    weather?.current?.condition,
    weather?.current?.isDay,
    weather?.current?.temp,
    weather?.current?.feelsLike,
    weather?.current?.wind,
    weather?.daily?.[0]?.pop,
    weather?.fetchedAt,
  ])

  const { mood, windy } = scene
  const tip = tipFor(mood, lang)

  return (
    <div className={`wx-character mood-${mood} ${windy ? 'is-windy' : ''} ${className}`} aria-hidden>
      <SceneFX mood={mood} windy={windy} />
      <div className="wx-character-stage">
        <PersonSVG mood={mood} windy={windy} />
      </div>
      <p className="wx-character-tip">{tip}</p>
    </div>
  )
}
