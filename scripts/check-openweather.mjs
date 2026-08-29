#!/usr/bin/env node
/**
 * Check if OpenWeather key works + if live site is using it.
 *
 * Usage (key NEVER goes in chat — only in your terminal):
 *
 *   # A) Test the key itself (Kanpur sample)
 *   OPENWEATHER_API_KEY=your_key node scripts/check-openweather.mjs
 *
 *   # B) Test deployed site (no key needed on your machine)
 *   node scripts/check-openweather.mjs --url https://weather-gpt-delta.vercel.app
 *
 *   # Both:
 *   OPENWEATHER_API_KEY=your_key node scripts/check-openweather.mjs --url https://weather-gpt-delta.vercel.app
 */

const KEY =
  (process.env.OPENWEATHER_API_KEY ||
    process.env.OPEN_WEATHER_API_KEY ||
    process.env.OWM_API_KEY ||
    '')
    .trim()
    .replace(/^["']|["']$/g, '')

const args = process.argv.slice(2)
let siteUrl = ''
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) siteUrl = args[++i].replace(/\/$/, '')
  else if (args[i].startsWith('--url=')) siteUrl = args[i].slice(6).replace(/\/$/, '')
  else if (/^https?:\/\//.test(args[i])) siteUrl = args[i].replace(/\/$/, '')
}

const KANPUR = { lat: 26.4499, lon: 80.3319, name: 'Kanpur' }

function line(ok, msg) {
  const tag = ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO'
  console.log(`[${tag}] ${msg}`)
}

async function fetchJson(url, ms = 15000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'WeatherGPT-OW-check/1.0' },
      signal: ctrl.signal,
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* */
    }
    return { status: res.status, ok: res.ok, text: text.slice(0, 300), json }
  } finally {
    clearTimeout(t)
  }
}

async function checkKeyDirect() {
  console.log('\n══ A) Direct OpenWeather key test ══')
  if (!KEY) {
    line(null, 'No OPENWEATHER_API_KEY in this shell — skip direct test.')
    line(null, 'Run: OPENWEATHER_API_KEY=xxxx node scripts/check-openweather.mjs')
    return null
  }
  line(null, `Key length: ${KEY.length} chars (not printing key)`)

  const q = `lat=${KANPUR.lat}&lon=${KANPUR.lon}&appid=${encodeURIComponent(KEY)}&units=metric`

  // Free current
  const cur = await fetchJson(`https://api.openweathermap.org/data/2.5/weather?${q}`)
  if (cur.status === 401) {
    line(false, '401 Unauthorized — key invalid, wrong, or not activated yet (wait up to 2h after create).')
    if (cur.json?.message) line(null, `OW message: ${cur.json.message}`)
    return false
  }
  if (cur.status === 429) {
    line(false, '429 Too many requests — key works but rate-limited. Wait & retry.')
    return false
  }
  if (!cur.ok || !cur.json?.main) {
    line(false, `Current weather failed HTTP ${cur.status}: ${(cur.json && cur.json.message) || cur.text}`)
    return false
  }
  const t = cur.json.main.temp
  const desc = cur.json.weather?.[0]?.description || '—'
  line(true, `2.5 current OK · ${KANPUR.name} · ${t}°C · ${desc} · live station/model blend`)

  // Forecast
  const fc = await fetchJson(`https://api.openweathermap.org/data/2.5/forecast?${q}`)
  if (fc.ok && fc.json?.list?.length) {
    line(true, `2.5 forecast OK · ${fc.json.list.length} slots (3-hourly)`)
  } else {
    line(false, `2.5 forecast HTTP ${fc.status}: ${(fc.json && fc.json.message) || fc.text}`)
  }

  // One Call 3.0 (optional)
  const oc = await fetchJson(
    `https://api.openweathermap.org/data/3.0/onecall?${q}&exclude=minutely,alerts`,
  )
  if (oc.ok && oc.json?.current) {
    line(true, 'One Call 3.0 OK (your key has 3.0 access)')
  } else if (oc.status === 401 || oc.status === 403) {
    line(null, 'One Call 3.0 not on this key — OK, app will use free 2.5')
  } else {
    line(null, `One Call 3.0 HTTP ${oc.status} — app falls back to 2.5 (fine for free tier)`)
  }

  return true
}

async function checkSite(url) {
  console.log(`\n══ B) Live site API · ${url} ══`)
  const wxUrl =
    `${url}/api/weather?lat=${KANPUR.lat}&lon=${KANPUR.lon}` +
    `&tz=Asia%2FKolkata&name=Kanpur&multimodel=0`
  const wx = await fetchJson(wxUrl)
  if (!wx.ok || !wx.json) {
    line(false, `/api/weather HTTP ${wx.status} — deploy old? or site down. Body: ${wx.text}`)
    return false
  }

  const j = wx.json
  const src = j._source || j.model || j.model_meta?.source || '—'
  const configured = j.openweather_configured
  const live = j.live
  const temp =
    j.current?.temperature_2m ??
    j.current?.temp ??
    j.current_weather?.temperature ??
    null

  line(!!live, `live=${live} · _source=${src} · temp≈${temp}`)
  if (configured === true) {
    line(true, 'openweather_configured=true → Vercel env key is present on server')
  } else if (configured === false) {
    line(false, 'openweather_configured=false → OPENWEATHER_API_KEY NOT set on this deployment')
  } else {
    line(
      null,
      'Response has no openweather_configured field → OLD build still live. Redeploy latest zip + clear SW.',
    )
  }

  const usingOw = /openweather/i.test(String(src))
  if (usingOw) {
    line(true, 'PRIMARY feed is OpenWeather — key ACTIVE and working on site')
  } else if (configured === true) {
    line(
      false,
      `Key is on server but primary is still "${src}". Check provider_chain.errors / OW activate delay.`,
    )
    if (j.provider_chain?.errors) line(null, `errors: ${JSON.stringify(j.provider_chain.errors)}`)
    if (j.openweather_meta?.error) line(null, `ow meta: ${j.openweather_meta.error}`)
  } else {
    line(false, 'Site not using OpenWeather yet (Open-Meteo fallback or old code)')
  }

  // world-mesh
  const mesh = await fetchJson(`${url}/api/world-mesh`)
  if (mesh.status === 404) {
    line(false, '/api/world-mesh 404 — new API not deployed yet')
  } else if (mesh.ok && mesh.json?.ok) {
    line(
      true,
      `world-mesh OK · provider=${mesh.json.provider} · points=${mesh.json.count} · ow_cfg=${mesh.json.openweather_configured}`,
    )
    if (mesh.json.provider === 'openweathermap') {
      line(true, 'Map mesh using OpenWeather live currents')
    }
  } else {
    line(false, `/api/world-mesh HTTP ${mesh.status}: ${(mesh.json && mesh.json.error) || mesh.text}`)
  }

  return usingOw
}

async function main() {
  console.log('WeatherGPT · OpenWeather activation check')
  console.log('(Key is never printed.)')

  const keyOk = await checkKeyDirect()
  let siteOk = null
  if (siteUrl) {
    siteOk = await checkSite(siteUrl)
  } else {
    console.log('\n══ B) Site check skipped ══')
    line(null, 'Add: --url https://weather-gpt-delta.vercel.app')
  }

  console.log('\n══ Summary ══')
  if (keyOk === true) line(true, 'Your API key can call OpenWeather right now.')
  if (keyOk === false) line(false, 'Fix/activate key on openweathermap.org before Vercel will work.')
  if (siteOk === true) line(true, 'Deployed site is ACTIVE on OpenWeather.')
  if (siteOk === false) {
    line(false, 'Site NOT fully on OpenWeather yet.')
    console.log(`
Next:
  1) Vercel → Settings → Environment Variables → OPENWEATHER_API_KEY
  2) Redeploy production (env change needs new deploy)
  3) Browser: Unregister SW + Clear site data
  4) Re-run this script with --url
`)
  }
  if (keyOk == null && siteOk == null) {
    console.log(`
Examples:
  OPENWEATHER_API_KEY=xxxx node scripts/check-openweather.mjs
  node scripts/check-openweather.mjs --url https://weather-gpt-delta.vercel.app
`)
  }
}

main().catch((e) => {
  console.error('ERROR', e.message || e)
  process.exit(1)
})
