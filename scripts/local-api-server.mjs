/**
 * Local API server so vite preview/dev can hit real /api/chat with Gemini.
 * Loads .env.local / .env then serves api/*.js handlers.
 *
 *   node scripts/local-api-server.mjs
 *   → http://127.0.0.1:8787/api/chat
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnvFile(file) {
  const p = join(root, file)
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const PORT = Number(process.env.LOCAL_API_PORT || 8787)

const handlers = {
  '/api/chat': join(root, 'api/chat.js'),
  '/api/weather': join(root, 'api/weather.js'),
  '/api/geocode': join(root, 'api/geocode.js'),
  '/api/aqi': join(root, 'api/aqi.js'),
  '/api/alerts': join(root, 'api/alerts.js'),
  '/api/climate': join(root, 'api/climate.js'),
  '/api/models': join(root, 'api/models.js'),
  '/api/public': join(root, 'api/public.js'),
}

function makeRes(res) {
  const headers = {}
  return {
    statusCode: 200,
    setHeader(k, v) {
      headers[k] = v
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(obj) {
      const body = JSON.stringify(obj)
      headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      res.writeHead(this.statusCode, headers)
      res.end(body)
    },
    end(data) {
      res.writeHead(this.statusCode, headers)
      res.end(data ?? '')
    },
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const path = url.pathname.replace(/\/$/, '') || '/'

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  const file = handlers[path]
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: false, error: 'not found', path }))
  }

  try {
    const mod = await import(pathToFileURL(file).href + '?t=' + Date.now())
    const handler = mod.default
    if (typeof handler !== 'function') throw new Error('no default export')

    // Collect body
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks).toString('utf8')
    let body = {}
    if (raw) {
      try {
        body = JSON.parse(raw)
      } catch {
        body = raw
      }
    }

    const fakeReq = {
      method: req.method,
      url: url.pathname + url.search,
      headers: req.headers,
      body,
      query: Object.fromEntries(url.searchParams),
      [Symbol.asyncIterator]: async function* () {
        if (raw) yield Buffer.from(raw)
      },
    }

    const fakeRes = makeRes(res)
    await handler(fakeReq, fakeRes)
  } catch (e) {
    console.error('[local-api]', path, e)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: e.message || 'server error' }))
    }
  }
})

server.listen(PORT, '0.0.0.0', () => {
  const hasGemini = !!process.env.GEMINI_API_KEY
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  console.log(`[local-api] http://0.0.0.0:${PORT}`)
  console.log(`[local-api] GEMINI_API_KEY: ${hasGemini ? 'SET' : 'MISSING'}`)
  console.log(`[local-api] OPENAI_API_KEY: ${hasOpenAI ? 'SET' : 'missing'}`)
  console.log(`[local-api] model: ${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}`)
  if (!hasGemini) {
    console.log('[local-api] Add GEMINI_API_KEY to .env.local then restart this server.')
  }
})
