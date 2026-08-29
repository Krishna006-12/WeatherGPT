/**
 * Live world weather map on the dashboard.
 * - Basemap: CARTO dark (OSM)
 * - Rain radar: RainViewer past + nowcast frames (live, free)
 * - Temperature / humidity / clouds: Open-Meteo live samples at global cities
 *   (honest point mesh — not fabricated heatmaps)
 * - Timelapse: steps radar frames OR forecast hours on the sample mesh
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Cloud,
  CloudRain,
  Droplets,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Thermometer,
} from 'lucide-react'

const RV_API = 'https://api.rainviewer.com/public/weather-maps.json'

/** Major world + India sample points for live OM mesh */
const SAMPLE_CITIES = [
  { name: 'Kanpur', lat: 26.45, lon: 80.33 },
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36 },
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Tokyo', lat: 35.68, lon: 139.65 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.05 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Beijing', lat: 39.9, lon: 116.4 },
  { name: 'Moscow', lat: 55.76, lon: 37.62 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Jakarta', lat: -6.21, lon: 106.85 },
  { name: 'Bangkok', lat: 13.76, lon: 100.5 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  { name: 'Perth', lat: -31.95, lon: 115.86 },
  { name: 'Anchorage', lat: 61.22, lon: -149.9 },
]

const LAYERS = [
  { id: 'temp', en: 'Temperature', hi: 'तापमान', icon: Thermometer, kind: 'mesh', field: 'temp' },
  { id: 'clouds', en: 'Clouds', hi: 'बादल', icon: Cloud, kind: 'mesh', field: 'cloud' },
  { id: 'humidity', en: 'Humidity', hi: 'नमी', icon: Droplets, kind: 'mesh', field: 'humidity' },
  { id: 'radar', en: 'Rain radar', hi: 'बारिश रडार', icon: CloudRain, kind: 'radar' },
]

function tempColor(t) {
  if (t == null || Number.isNaN(t)) return '#64748b'
  if (t <= -10) return '#312e81'
  if (t <= 0) return '#1d4ed8'
  if (t <= 10) return '#38bdf8'
  if (t <= 18) return '#4ade80'
  if (t <= 26) return '#facc15'
  if (t <= 32) return '#fb923c'
  if (t <= 38) return '#f97316'
  return '#ef4444'
}

function humidityColor(h) {
  if (h == null || Number.isNaN(h)) return '#64748b'
  if (h < 30) return '#fde68a'
  if (h < 50) return '#86efac'
  if (h < 70) return '#38bdf8'
  if (h < 85) return '#3b82f6'
  return '#1e3a8a'
}

function cloudColor(c) {
  if (c == null || Number.isNaN(c)) return '#64748b'
  const a = Math.min(1, Math.max(0.15, c / 100))
  return `rgba(220,230,245,${0.25 + a * 0.65})`
}

function basemapUrl() {
  return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
}

async function fetchMeshHour(hourOffset = 0) {
  // Batch Open-Meteo multi-lat/lon
  const lats = SAMPLE_CITIES.map((c) => c.lat).join(',')
  const lons = SAMPLE_CITIES.map((c) => c.lon).join(',')
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=temperature_2m,relative_humidity_2m,cloud_cover,precipitation_probability` +
    `&forecast_days=2&timezone=UTC`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = await res.json()
  const rows = Array.isArray(data) ? data : [data]
  return rows.map((row, i) => {
    const h = row.hourly || {}
    const idx = Math.min(hourOffset, (h.time?.length || 1) - 1)
    return {
      ...SAMPLE_CITIES[i],
      temp: h.temperature_2m?.[idx] ?? null,
      humidity: h.relative_humidity_2m?.[idx] ?? null,
      cloud: h.cloud_cover?.[idx] ?? null,
      pop: h.precipitation_probability?.[idx] ?? null,
      time: h.time?.[idx] || null,
    }
  })
}

export default function LiveWorldMap({ lang = 'en', city, weather, compact = false }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const radarRef = useRef(null)
  const meshLayerRef = useRef(null)
  const markerRef = useRef(null)
  const [layer, setLayer] = useState('temp')
  const [playing, setPlaying] = useState(false)
  const [frameIdx, setFrameIdx] = useState(0)
  const [radarFrames, setRadarFrames] = useState([])
  const [meshByHour, setMeshByHour] = useState({}) // hour -> points
  const [hour, setHour] = useState(0)
  const [err, setErr] = useState(null)
  const [ready, setReady] = useState(false)
  const [loadingMesh, setLoadingMesh] = useState(false)
  const [meshProvider, setMeshProvider] = useState(null)

  const lat = city?.lat ?? weather?.city?.lat ?? weather?.location?.lat ?? 26.45
  const lon = city?.lon ?? weather?.city?.lon ?? weather?.location?.lon ?? 80.33
  const placeName =
    (lang === 'hi' ? city?.name_hi || weather?.city?.name_hi : null) ||
    city?.name ||
    weather?.city?.name ||
    '—'

  const active = LAYERS.find((l) => l.id === layer) || LAYERS[0]

  // Radar catalog
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(RV_API)
        const j = await res.json()
        if (cancelled) return
        const host = j.host || 'https://tilecache.rainviewer.com'
        const past = (j.radar?.past || []).map((f) => ({
          time: f.time,
          path: `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
          label: new Date(f.time * 1000).toISOString().slice(11, 16) + 'Z',
          kind: 'past',
        }))
        const nowcast = (j.radar?.nowcast || []).map((f) => ({
          time: f.time,
          path: `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
          label: new Date(f.time * 1000).toISOString().slice(11, 16) + 'Z',
          kind: 'nowcast',
        }))
        const frames = [...past, ...nowcast]
        setRadarFrames(frames)
        setFrameIdx(Math.max(0, past.length - 1))
      } catch (e) {
        if (!cancelled) setErr(String(e?.message || e).slice(0, 100))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Prefetch mesh: prefer same-origin /api/world-mesh (OW key on server) → Open-Meteo
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMesh(true)
      try {
        // 1) Server mesh (OpenWeather current when key set + OM hours)
        try {
          const res = await fetch('/api/world-mesh', { headers: { Accept: 'application/json' } })
          if (res.ok) {
            const j = await res.json()
            if (j?.ok && (j.byHour || j.points?.length)) {
              const byHour = {}
              if (j.byHour && typeof j.byHour === 'object') {
                for (const [k, v] of Object.entries(j.byHour)) {
                  byHour[Number(k)] = v
                }
              }
              // Overlay live OW current onto hour 0 when present
              if (j.points?.length) {
                const live = j.points.map((p) => ({
                  name: p.name,
                  lat: p.lat,
                  lon: p.lon,
                  temp: p.temp,
                  humidity: p.humidity,
                  cloud: p.cloud,
                  pop: p.pop ?? null,
                  time: p.time || null,
                  provider: p.provider || j.provider,
                }))
                byHour[0] = live
                if (!Object.keys(byHour).filter((k) => Number(k) > 0).length) {
                  // only current — still show hour 0
                }
              }
              if (!cancelled) {
                setMeshByHour(byHour)
                setMeshProvider(j.provider || (j.openweather_configured ? 'openweathermap' : 'open-meteo'))
              }
              return
            }
          }
        } catch {
          /* fall through */
        }

        // 2) Direct Open-Meteo bulk (dev / no proxy)
        const lats = SAMPLE_CITIES.map((c) => c.lat).join(',')
        const lons = SAMPLE_CITIES.map((c) => c.lon).join(',')
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
          `&hourly=temperature_2m,relative_humidity_2m,cloud_cover,precipitation_probability` +
          `&forecast_days=2&timezone=UTC`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
        const data = await res.json()
        const rows = Array.isArray(data) ? data : [data]
        const byHour = {}
        const n = Math.min(24, rows[0]?.hourly?.time?.length || 0)
        for (let h = 0; h < n; h++) {
          byHour[h] = rows.map((row, i) => {
            const hr = row.hourly || {}
            return {
              ...SAMPLE_CITIES[i],
              temp: hr.temperature_2m?.[h] ?? null,
              humidity: hr.relative_humidity_2m?.[h] ?? null,
              cloud: hr.cloud_cover?.[h] ?? null,
              pop: hr.precipitation_probability?.[h] ?? null,
              time: hr.time?.[h] || null,
            }
          })
        }
        if (!cancelled) {
          setMeshByHour(byHour)
          setMeshProvider('open-meteo')
        }
      } catch (e) {
        if (!cancelled) {
          setErr(String(e?.message || e).slice(0, 100))
          try {
            const pts = await fetchMeshHour(0)
            if (!cancelled) {
              setMeshByHour({ 0: pts })
              setMeshProvider('open-meteo')
            }
          } catch {
            /* */
          }
        }
      } finally {
        if (!cancelled) setLoadingMesh(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Init map
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined
    const map = L.map(mapEl.current, {
      center: [lat, lon],
      zoom: 3,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      worldCopyJump: true,
    })
    L.tileLayer(basemapUrl(), {
      maxZoom: 8,
      minZoom: 2,
      attribution:
        '&copy; OSM · CARTO · Open-Meteo · RainViewer',
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    markerRef.current = L.circleMarker([lat, lon], {
      radius: 8,
      color: '#fff',
      weight: 2,
      fillColor: '#5eb0ff',
      fillOpacity: 0.95,
    })
      .addTo(map)
      .bindTooltip(placeName, { direction: 'top' })
    mapRef.current = map
    setReady(true)
    const ro = new ResizeObserver(() => {
      try {
        map.invalidateSize()
      } catch {
        /* */
      }
    })
    ro.observe(mapEl.current)
    return () => {
      ro.disconnect()
      try {
        map.remove()
      } catch {
        /* */
      }
      mapRef.current = null
      radarRef.current = null
      meshLayerRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || lat == null) return
    map.setView([lat, lon], Math.max(map.getZoom(), 3), { animate: true })
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon])
      markerRef.current.setTooltipContent(placeName)
    }
  }, [lat, lon, placeName])

  const clearOverlays = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (radarRef.current) {
      try {
        map.removeLayer(radarRef.current)
      } catch {
        /* */
      }
      radarRef.current = null
    }
    if (meshLayerRef.current) {
      try {
        map.removeLayer(meshLayerRef.current)
      } catch {
        /* */
      }
      meshLayerRef.current = null
    }
  }, [])

  const paint = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    clearOverlays()

    if (active.kind === 'radar') {
      const frame = radarFrames[frameIdx] || radarFrames[radarFrames.length - 1]
      if (!frame) return
      const tl = L.tileLayer(frame.path, {
        opacity: 0.75,
        maxZoom: 8,
        minZoom: 2,
        zIndex: 300,
      })
      tl.addTo(map)
      radarRef.current = tl
      return
    }

    const pts = meshByHour[hour] || meshByHour[0] || []
    const group = L.layerGroup()
    pts.forEach((p) => {
      let fill = '#64748b'
      let label = p.name
      let radius = 9
      if (active.field === 'temp') {
        fill = tempColor(p.temp)
        label = `${p.name}: ${p.temp != null ? Math.round(p.temp) + '°C' : '—'}`
        radius = 10
      } else if (active.field === 'humidity') {
        fill = humidityColor(p.humidity)
        label = `${p.name}: ${p.humidity != null ? Math.round(p.humidity) + '%' : '—'} RH`
      } else if (active.field === 'cloud') {
        fill = cloudColor(p.cloud)
        label = `${p.name}: ${p.cloud != null ? Math.round(p.cloud) + '%' : '—'} cloud`
        radius = 8 + (Number(p.cloud) || 0) / 25
      }
      const m = L.circleMarker([p.lat, p.lon], {
        radius,
        color: 'rgba(255,255,255,0.35)',
        weight: 1,
        fillColor: fill,
        fillOpacity: 0.85,
      }).bindTooltip(label, { direction: 'top' })
      group.addLayer(m)
    })
    group.addTo(map)
    meshLayerRef.current = group
  }, [active, clearOverlays, frameIdx, hour, meshByHour, radarFrames])

  useEffect(() => {
    if (!ready) return
    paint()
  }, [ready, paint, layer])

  // Timelapse
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      if (active.kind === 'radar') {
        setFrameIdx((i) => (radarFrames.length ? (i + 1) % radarFrames.length : 0))
      } else {
        const maxH = Object.keys(meshByHour).length || 24
        setHour((h) => (h + 1) % maxH)
      }
    }, 850)
    return () => clearInterval(id)
  }, [playing, active.kind, radarFrames.length, meshByHour])

  useEffect(() => {
    if (!ready || active.kind === 'radar') return
    paint()
  }, [hour, ready, active.kind, paint])

  useEffect(() => {
    if (!ready || active.kind !== 'radar') return
    paint()
  }, [frameIdx, ready, active.kind, paint])

  const timeLabel = useMemo(() => {
    if (active.kind === 'radar') {
      const f = radarFrames[frameIdx]
      if (!f) return loadingMesh ? '…' : '—'
      const tag =
        f.kind === 'nowcast'
          ? lang === 'hi'
            ? 'nowcast'
            : 'nowcast'
          : lang === 'hi'
            ? 'past'
            : 'past'
      return `${f.label} · ${tag}`
    }
    const pts = meshByHour[hour] || []
    const t0 = pts[0]?.time
    if (t0) return `${t0.replace('T', ' ')} UTC · +${hour}h`
    return `+${hour}h`
  }, [active.kind, frameIdx, radarFrames, hour, meshByHour, lang, loadingMesh])

  const step = (dir) => {
    if (active.kind === 'radar') {
      setFrameIdx((i) => {
        if (!radarFrames.length) return 0
        return (i + dir + radarFrames.length) % radarFrames.length
      })
    } else {
      const maxH = Object.keys(meshByHour).length || 24
      setHour((h) => (h + dir + maxH) % maxH)
    }
  }

  return (
    <section
      className="wx-world-map wx-open-panel"
      aria-label={lang === 'hi' ? 'लाइव विश्व मानचित्र' : 'Live world map'}
    >
      <div className="wx-world-head">
        <div className="min-w-0">
          <h3 className="wx-section-title">
            {lang === 'hi' ? 'लाइव विश्व मौसम' : 'Live world weather'}
          </h3>
          <p className="wx-world-sub">
            {placeName} · {timeLabel}
            {loadingMesh ? (lang === 'hi' ? ' · लोड…' : ' · loading…') : ''}
            {err ? ` · ${err}` : ''}
          </p>
        </div>
        <div className="wx-world-layers" role="tablist">
          {LAYERS.map((l) => {
            const Icon = l.icon
            const on = l.id === layer
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`wx-world-layer focus-ring ${on ? 'is-on' : ''}`}
                onClick={() => {
                  setLayer(l.id)
                  setPlaying(false)
                }}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
                <span>{lang === 'hi' ? l.hi : l.en}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={`wx-world-stage ${compact ? 'is-compact' : ''}`}>
        <div ref={mapEl} className="wx-world-leaflet" />
        <div className="wx-world-controls">
          <button
            type="button"
            className="wx-world-btn focus-ring"
            onClick={() => step(-1)}
            aria-label={lang === 'hi' ? 'पिछला' : 'Previous frame'}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className={`wx-world-btn wx-world-play focus-ring ${playing ? 'is-on' : ''}`}
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{lang === 'hi' ? 'टाइमलैप्स' : 'Timelapse'}</span>
          </button>
          <button
            type="button"
            className="wx-world-btn focus-ring"
            onClick={() => step(1)}
            aria-label={lang === 'hi' ? 'अगला' : 'Next frame'}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="wx-world-foot">
        {active.kind === 'radar'
          ? lang === 'hi'
            ? 'RainViewer रडार (past + nowcast) · IMD आधिकारिक नहीं'
            : 'RainViewer radar (past + nowcast) · not official IMD'
          : meshProvider === 'openweathermap'
            ? lang === 'hi'
              ? 'OpenWeather लाइव करंट · टाइमलैप्स घंटे Open-Meteo · नकली नहीं'
              : 'OpenWeather live current · timelapse hours Open-Meteo · not fabricated'
            : lang === 'hi'
              ? 'Open-Meteo लाइव सैंपल शहर · रंग = तापमान/नमी/बादल · टाइमलैप्स = पूर्वानुमान घंटे'
              : 'Open-Meteo live city samples · color = temp/humidity/clouds · timelapse = forecast hours'}
        {' · '}
        {lang === 'hi' ? 'नकली डेटा नहीं' : 'no fabricated data'}
      </p>
    </section>
  )
}
