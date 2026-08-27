import React from 'react'

export default function WeatherAnimations({ weatherType = 'clear', isDay = true, isRain = false }) {
  if (isRain || weatherType === 'rain' || weatherType === 'heavy_rain') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="rain-container">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="raindrop"
              style={{
                left: `${(i * 4.2) + Math.random() * 2}%`,
                animationDelay: `${(i % 5) * 0.18}s`,
                animationDuration: `${0.65 + (i % 3) * 0.15}s`
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (weatherType === 'thunderstorm') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-sky-900/20 animate-pulse" />
        <div className="lightning-flash" />
        <div className="rain-container opacity-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="raindrop"
              style={{
                left: `${(i * 3.3)}%`,
                animationDelay: `${(i % 4) * 0.12}s`,
                animationDuration: `${0.55 + (i % 3) * 0.1}s`
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (weatherType === 'fog') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-30">
        <div className="fog-layer fog-layer-1" />
        <div className="fog-layer fog-layer-2" />
      </div>
    )
  }

  if (weatherType === 'clear' && isDay) {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
        <div className="sunbeam-halo" />
        <div className="sun-lens-flare" />
      </div>
    )
  }

  if (!isDay) {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="twinkle-star"
            style={{
              top: `${(i * 4.5 + Math.random() * 10)}%`,
              left: `${(i * 5 + Math.random() * 8)}%`,
              animationDelay: `${(i % 4) * 0.5}s`
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
      <div className="cloud-drift" />
    </div>
  )
}
