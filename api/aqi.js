/** GET /api/aqi?lat=&lon= — proxy Open-Meteo Air Quality */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat lon required' })
    }
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.0' },
    })
    clearTimeout(t)
    const text = await r.text()
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 200) })
    if (text.trimStart().startsWith('<')) return res.status(502).json({ error: 'HTML' })
    return res.status(200).json({ ...JSON.parse(text), _proxy: true })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
