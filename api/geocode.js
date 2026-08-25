/** GET /api/geocode?q=Kanpur&count=8 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const q = (req.query.q || req.query.name || '').toString().trim()
    const count = Math.min(parseInt(req.query.count || '10', 10) || 10, 20)
    const language = (req.query.language || 'en').toString()
    if (q.length < 2) return res.status(400).json({ results: [] })

    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
      `&count=${count}&language=${encodeURIComponent(language)}&format=json`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.0' },
    })
    clearTimeout(timer)
    const text = await r.text()
    if (!r.ok) return res.status(r.status).json({ results: [], error: text.slice(0, 120) })
    if (text.trimStart().startsWith('<')) return res.status(502).json({ results: [], error: 'HTML' })
    return res.status(200).json({ ...JSON.parse(text), _proxy: true })
  } catch (e) {
    return res.status(502).json({ results: [], error: e.message })
  }
}
