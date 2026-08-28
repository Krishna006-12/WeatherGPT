/**
 * Samsung Weather–style complete 2D characters.
 * Filled flat illustration (NOT stick strokes) — full body + props per mood.
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

/* ── Shared palette ── */
const SKIN = '#E8B888'
const SKIN_SH = '#D49A68'
const HAIR = '#3D2914'
const BOOT_DK = '#1B2430'
const BOOT_BR = '#5C4030'

function DropFX({ count = 12, storm = false }) {
  return (
    <g className="wx-svg-rain" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const x = 18 + ((i * 17) % 140)
        const y = 8 + (i % 5) * 6
        const h = storm && i % 4 === 0 ? 16 : 10
        return (
          <line
            key={i}
            className={storm && i % 4 === 0 ? 'wx-svg-drop bolt' : 'wx-svg-drop'}
            x1={x}
            y1={y}
            x2={x - 2}
            y2={y + h}
            stroke={storm && i % 4 === 0 ? '#FFE08A' : 'rgba(200,230,255,0.85)'}
            strokeWidth={storm && i % 4 === 0 ? 2.2 : 1.6}
            strokeLinecap="round"
            style={{
              animationDelay: `${(i % 7) * 0.11}s`,
              animationDuration: `${0.65 + (i % 4) * 0.12}s`,
            }}
          />
        )
      })}
    </g>
  )
}

function CloudBlob({ cx, cy, sc = 1, fill = 'rgba(255,255,255,0.55)' }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${sc})`}>
      <ellipse cx="0" cy="0" rx="22" ry="12" fill={fill} />
      <ellipse cx="-14" cy="2" rx="14" ry="10" fill={fill} />
      <ellipse cx="14" cy="3" rx="14" ry="9" fill={fill} />
      <ellipse cx="-4" cy="-6" rx="12" ry="9" fill={fill} />
    </g>
  )
}

/** Complete filled person — one cohesive illustration per mood */
function PersonComplete({ mood, windy }) {
  const isRain = mood === 'rain' || mood === 'storm'
  const isSnow = mood === 'snow'
  const isCold = mood === 'cold' || isSnow
  const isHot = mood === 'hot'
  const isSun = mood === 'sunny' || isHot
  const isNight = mood === 'night' || mood === 'night_clear'
  const isFog = mood === 'fog'
  const isCloud = mood === 'cloudy' || mood === 'partly'

  // Coat / outfit colors
  const coat = isRain || isStormish(mood) || isCold
    ? '#3A8FB5'
    : isHot
      ? '#F0A94A'
      : isNight
        ? '#4A5F8C'
        : '#5B9FD4'
  const coatDk = isRain || isStormish(mood) || isCold
    ? '#2A6F8F'
    : isHot
      ? '#D4892E'
      : isNight
        ? '#3A4A6E'
        : '#3D7EB0'
  const pants = isHot ? '#C4A06A' : isCold ? '#2C3A52' : '#5A6B7C'
  const boots = isRain || isStormish(mood) || isSnow ? BOOT_DK : BOOT_BR

  return (
    <svg
      className={`wx-person-svg ${windy ? 'is-windy' : ''} mood-${mood}`}
      viewBox="0 0 200 260"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      {/* ── Atmosphere behind person ── */}
      {(isSun) && (
        <g className="wx-svg-sun">
          <circle cx="158" cy="42" r="22" fill="#FFD56A" className="wx-sun-core" />
          <circle cx="158" cy="42" r="30" fill="rgba(255,210,100,0.28)" className="wx-sun-halo" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              className="wx-sun-spoke"
              x1="158"
              y1="42"
              x2={158 + Math.cos((deg * Math.PI) / 180) * 40}
              y2={42 + Math.sin((deg * Math.PI) / 180) * 40}
              stroke="rgba(255,210,100,0.7)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      {isNight && (
        <g className="wx-svg-night">
          <circle cx="160" cy="40" r="18" fill="#F0EBD0" className="wx-moon-core" />
          <circle cx="168" cy="34" r="14" fill="rgba(10,20,40,0.35)" />
          <circle cx="130" cy="28" r="1.8" fill="#fff" className="wx-star" />
          <circle cx="145" cy="18" r="1.2" fill="#fff" className="wx-star" />
          <circle cx="175" cy="22" r="1.5" fill="#fff" className="wx-star" />
          <circle cx="120" cy="48" r="1.1" fill="#fff" className="wx-star" />
        </g>
      )}
      {(isCloud || isFog) && (
        <g className="wx-svg-clouds" opacity="0.85">
          <CloudBlob cx="150" cy="36" sc={1.1} fill="rgba(255,255,255,0.5)" />
          <CloudBlob cx="40" cy="48" sc={0.75} fill="rgba(255,255,255,0.35)" />
        </g>
      )}
      {isFog && (
        <g className="wx-svg-fog" opacity="0.55">
          <ellipse cx="100" cy="200" rx="70" ry="10" fill="rgba(220,230,240,0.5)" className="wx-fog-e" />
          <ellipse cx="100" cy="175" rx="55" ry="8" fill="rgba(220,230,240,0.4)" className="wx-fog-e" />
        </g>
      )}
      {isRain && <DropFX count={mood === 'storm' ? 16 : 12} storm={mood === 'storm'} />}
      {isSnow && (
        <g className="wx-svg-snow">
          {Array.from({ length: 14 }, (_, i) => (
            <circle
              key={i}
              className="wx-svg-flake"
              cx={20 + ((i * 19) % 160)}
              cy={12 + (i % 6) * 8}
              r={1.5 + (i % 3) * 0.6}
              fill="#fff"
              style={{
                animationDelay: `${(i % 6) * 0.3}s`,
                animationDuration: `${2.2 + (i % 4) * 0.35}s`,
              }}
            />
          ))}
        </g>
      )}
      {mood === 'storm' && (
        <path
          className="wx-svg-flash"
          d="M118 20 L108 48 L116 48 L106 78"
          stroke="#FFE566"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}

      {/* ── Ground ── */}
      <ellipse
        cx="100"
        cy="246"
        rx={isRain ? 52 : 42}
        ry="8"
        fill={isRain ? 'rgba(80,150,210,0.35)' : 'rgba(0,0,0,0.28)'}
        className="wx-shadow"
      />
      {isRain && (
        <ellipse cx="96" cy="248" rx="22" ry="4.5" fill="rgba(120,180,230,0.5)" className="wx-puddle" />
      )}

      {/* ── LEGS (filled) ── */}
      <g className="wx-legs">
        <path
          d="M82 168 C80 188 76 210 74 228 L90 228 C92 210 94 188 96 168 Z"
          fill={pants}
        />
        <path
          d="M104 168 C106 188 110 210 112 228 L128 228 C126 210 122 188 118 168 Z"
          fill={pants}
        />
        {/* boots */}
        <path d="M68 226 C68 226 72 236 92 234 L90 226 Z" fill={boots} />
        <path d="M110 226 C110 226 114 236 134 234 L128 226 Z" fill={boots} />
      </g>

      {/* ── TORSO (filled coat) ── */}
      <g className="wx-torso">
        <path
          d="M70 96
             C66 100 64 130 68 168
             L132 168
             C136 130 134 100 130 96
             C120 88 80 88 70 96 Z"
          fill={coat}
        />
        {/* darker side panel */}
        <path
          d="M100 96 L100 168 L132 168 C136 130 134 100 130 96 C120 90 108 92 100 96 Z"
          fill={coatDk}
          opacity="0.45"
        />
        {/* zipper / center line */}
        <line x1="100" y1="100" x2="100" y2="164" stroke="rgba(0,0,0,0.18)" strokeWidth="2" />

        {/* hoodie hood (rain/cold) */}
        {(isRain || isStormish(mood) || isCold) && (
          <path
            d="M72 100
               C76 78 124 78 128 100
               C118 90 82 90 72 100 Z"
            fill={coatDk}
          />
        )}

        {/* bag (rain / cloudy) */}
        {(isRain || isCloud) && (
          <g>
            <path d="M128 108 Q148 130 132 168" stroke="#1E3348" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path
              d="M126 155 C126 155 148 158 146 182 C144 192 124 190 126 175 Z"
              fill="#1E3348"
            />
          </g>
        )}
      </g>

      {/* ── ARMS + PROPS ── */}
      <g className="wx-arms">
        {isRain || isStormish(mood) ? (
          <>
            {/* left arm up holding umbrella */}
            <path
              d="M72 108
                 C52 118 48 140 62 152
                 C70 158 78 150 82 142
                 C78 128 76 114 72 108 Z"
              fill={coat}
            />
            <circle cx="64" cy="150" r="7" fill={SKIN} />
            {/* right arm down */}
            <path
              d="M128 108
                 C148 120 150 148 136 160
                 C128 166 120 158 118 148
                 C122 130 126 114 128 108 Z"
              fill={coatDk}
            />
            <circle cx="134" cy="158" r="7" fill={SKIN} />
            {/* UMBRELLA — complete canopy */}
            <g className="wx-umbrella">
              <line x1="64" y1="150" x2="64" y2="58" stroke="#1A2433" strokeWidth="3.5" strokeLinecap="round" />
              <path
                d="M64 58
                   C64 58 64 36 28 52
                   C46 30 64 26 64 26
                   C64 26 82 30 100 52
                   C64 36 64 58 64 58 Z"
                fill="#1A2F4A"
              />
              <path
                d="M28 52 C46 38 64 34 64 34 C64 34 82 38 100 52"
                stroke="#0D1828"
                strokeWidth="2"
                fill="none"
              />
              {/* canopy ribs highlight */}
              <path d="M64 34 L40 50" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
              <path d="M64 34 L88 50" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
              {/* curved handle */}
              <path
                d="M64 150 Q54 162 62 168"
                stroke="#1A2433"
                strokeWidth="3.5"
                fill="none"
                strokeLinecap="round"
              />
            </g>
          </>
        ) : isSun ? (
          <>
            {/* relaxed arms out */}
            <path
              d="M72 110 C50 128 48 158 68 168 C76 172 84 162 84 152 C80 134 76 118 72 110 Z"
              fill={coat}
            />
            <circle cx="66" cy="166" r="7.5" fill={SKIN} />
            <path
              d="M128 110 C150 128 152 158 132 168 C124 172 116 162 116 152 C120 134 124 118 128 110 Z"
              fill={coatDk}
            />
            <circle cx="134" cy="166" r="7.5" fill={SKIN} />
          </>
        ) : isNight ? (
          <>
            <path
              d="M72 110 C52 126 50 156 68 166 C76 170 84 160 84 150 C80 132 76 116 72 110 Z"
              fill={coat}
            />
            <circle cx="66" cy="164" r="7" fill={SKIN} />
            <path
              d="M128 110 C148 124 150 150 134 162 C126 168 118 158 118 148 C122 130 126 116 128 110 Z"
              fill={coatDk}
            />
            <circle cx="132" cy="160" r="7" fill={SKIN} />
            {/* lantern */}
            <g className="wx-lantern">
              <rect x="122" y="168" width="18" height="22" rx="3" fill="#E8C86A" />
              <rect x="125" y="172" width="12" height="12" rx="1" fill="#FFF6C8" className="wx-lantern-glow" />
              <line x1="131" y1="168" x2="131" y2="160" stroke="#C9A84A" strokeWidth="2" />
              <circle cx="131" cy="158" r="3" fill="#C9A84A" />
            </g>
          </>
        ) : (
          <>
            {/* cloudy / fog / default — phone pose */}
            <path
              d="M72 110 C52 126 52 156 70 166 C78 170 86 160 86 150 C82 132 76 116 72 110 Z"
              fill={coat}
            />
            <circle cx="68" cy="164" r="7" fill={SKIN} />
            <path
              d="M128 108 C146 118 148 140 136 150 C128 156 120 148 120 140 C124 124 126 112 128 108 Z"
              fill={coatDk}
            />
            <circle cx="132" cy="148" r="6.5" fill={SKIN} />
            <g className="wx-phone">
              <rect x="124" y="132" width="16" height="26" rx="3" fill="#1A2433" />
              <rect x="126" y="136" width="12" height="16" rx="1.5" fill="#5BB8E8" opacity="0.85" />
              <circle cx="132" cy="155" r="1.5" fill="#445" />
            </g>
          </>
        )}
      </g>

      {/* scarf */}
      {isCold && (
        <g className="wx-scarf">
          <path
            d="M78 108 C90 122 110 122 122 108 C116 118 84 118 78 108 Z"
            fill="#C45C4A"
          />
          <path d="M108 116 L114 158 L106 158 L104 116 Z" fill="#A84838" />
          <path d="M106 156 l4 8 m-2 -4 l4 6" stroke="#C45C4A" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {/* ── HEAD (complete) ── */}
      <g className="wx-head">
        {/* neck */}
        <rect x="92" y="88" width="16" height="14" rx="4" fill={SKIN} />
        {/* face */}
        <circle cx="100" cy="72" r="26" fill={SKIN} />
        <ellipse cx="100" cy="78" rx="20" ry="18" fill={SKIN_SH} opacity="0.15" />

        {/* hair */}
        <path
          d="M76 70
             C76 48 124 48 124 70
             C120 58 110 54 100 54
             C90 54 80 58 76 70 Z"
          fill={HAIR}
        />
        {/* side hair */}
        <path d="M76 70 C74 82 78 88 82 90" stroke={HAIR} strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M124 70 C126 82 122 88 118 90" stroke={HAIR} strokeWidth="8" strokeLinecap="round" fill="none" />

        {/* hood rim over hair when raining */}
        {(isRain || isStormish(mood)) && (
          <path
            d="M74 78 C78 58 122 58 126 78"
            stroke={coatDk}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            opacity="0.9"
          />
        )}

        {/* face features */}
        {isSun ? (
          <g>
            {/* sunglasses */}
            <rect x="82" y="68" width="14" height="9" rx="3" fill="#1A2433" />
            <rect x="104" y="68" width="14" height="9" rx="3" fill="#1A2433" />
            <path d="M96 72 H104" stroke="#1A2433" strokeWidth="2" />
            <rect x="84" y="69.5" width="5" height="3" rx="1" fill="rgba(255,255,255,0.25)" />
            {/* smile */}
            <path d="M90 84 Q100 92 110 84" stroke="#A86B48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        ) : mood === 'storm' || isHot ? (
          <g>
            <circle cx="90" cy="72" r="2.8" fill="#2A1F18" />
            <circle cx="110" cy="72" r="2.8" fill="#2A1F18" />
            {/* worried mouth */}
            <path d="M90 86 Q100 80 110 86" stroke="#A86B48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            {/* brow */}
            <path d="M84 66 L94 68" stroke="#2A1F18" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M116 66 L106 68" stroke="#2A1F18" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="90" cy="72" r="2.8" fill="#2A1F18" />
            <circle cx="110" cy="72" r="2.8" fill="#2A1F18" />
            {/* eye shine */}
            <circle cx="91" cy="71" r="0.9" fill="#fff" opacity="0.7" />
            <circle cx="111" cy="71" r="0.9" fill="#fff" opacity="0.7" />
            <path d="M90 84 Q100 91 110 84" stroke="#A86B48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        )}
      </g>

      {/* heat waves */}
      {isHot && (
        <g className="wx-heat" opacity="0.65">
          <path d="M48 120 Q42 108 48 96" stroke="#FFB84D" strokeWidth="2.5" fill="none" className="wx-heat-w" strokeLinecap="round" />
          <path d="M152 120 Q158 108 152 96" stroke="#FFB84D" strokeWidth="2.5" fill="none" className="wx-heat-w" strokeLinecap="round" />
          <path d="M40 140 Q34 128 40 116" stroke="#FFB84D" strokeWidth="2" fill="none" className="wx-heat-w" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

function isStormish(mood) {
  return mood === 'storm'
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
      className={`wx-character mood-${mood} ${windy ? 'is-windy' : ''} ${className}`}
      role="img"
      aria-label={tip}
    >
      <div className="wx-character-stage">
        <PersonComplete mood={mood} windy={windy} />
      </div>
      <p className="wx-character-tip">{tip}</p>
    </div>
  )
}
