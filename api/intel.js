/**
 * Optional BFF proxy → Python WeatherGPT Intelligence service.
 *
 * React never talks to Python directly in production.
 * Node holds INTEL_SERVICE_KEY + INTEL_BASE_URL (server env only).
 *
 * If Python is down / unset → structured 503; existing JS engines remain primary.
 *
 * Routes:
 *   GET  /api/intel                 → status + capabilities passthrough
 *   GET  /api/intel?op=health
 *   POST /api/intel  { op, ...body } → /v1/{op}
 *
 * ops: preprocess | compare-models | confidence | crop-features | capabilities | health
 */
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

export const config = {
  maxDuration: 20,
  api: { bodyParser: true },
}

const DEFAULT_TIMEOUT_MS = 12_000

const OP_PATH = {
  health: '/health',
  capabilities: '/v1/capabilities',
  preprocess: '/v1/preprocess',
  'compare-models': '/v1/compare-models',
  confidence: '/v1/confidence',
  'crop-features': '/v1/crop-features',
}

function send(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(obj))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body)
      return
    }
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1_500_000) {
        reject(new Error('body_too_large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function intelBase() {
  const b = (process.env.INTEL_BASE_URL || process.env.PYTHON_INTEL_URL || '').trim()
  return b.replace(/\/$/, '')
}

function proxyRequest(method, path, bodyObj, timeoutMs) {
  const base = intelBase()
  if (!base) {
    const err = new Error('INTEL_BASE_URL not configured')
    err.code = 'intel_unconfigured'
    throw err
  }
  const full = new URL(path, base.endsWith('/') ? base : base + '/')
  const isHttps = full.protocol === 'https:'
  const lib = isHttps ? https : http
  const payload = bodyObj != null ? JSON.stringify(bodyObj) : null
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload)
  const key = (process.env.INTEL_SERVICE_KEY || '').trim()
  if (key) headers['X-Intel-Key'] = key

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: full.protocol,
        hostname: full.hostname,
        port: full.port || (isHttps ? 443 : 80),
        path: full.pathname + full.search,
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let data = ''
        res.on('data', (c) => {
          data += c
          if (data.length > 2_000_000) {
            req.destroy()
            reject(Object.assign(new Error('response_too_large'), { code: 'intel_response_large' }))
          }
        })
        res.on('end', () => {
          let json = null
          try {
            json = data ? JSON.parse(data) : null
          } catch {
            json = { ok: false, error: 'invalid_json_from_intel', raw: data.slice(0, 200) }
          }
          resolve({ status: res.statusCode || 502, json })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy()
      reject(Object.assign(new Error('intel_timeout'), { code: 'timeout' }))
    })
    req.on('error', (e) => {
      e.code = e.code || 'intel_network'
      reject(e)
    })
    if (payload) req.write(payload)
    req.end()
  })
}

export default async function handler(req, res) {
  // CORS for same-origin usually N/A; allow simple GET
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const base = intelBase()
  const configured = Boolean(base)

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://local')
      const op = url.searchParams.get('op') || 'status'

      if (op === 'status' || op === '') {
        return send(res, 200, {
          ok: true,
          service: 'weathergpt-intel-bff',
          configured,
          base_url_set: configured,
          // never echo key
          auth_header_configured: Boolean((process.env.INTEL_SERVICE_KEY || '').trim()),
          ops: Object.keys(OP_PATH),
          note: configured
            ? 'POST { op, ...payload } to proxy Python /v1/*'
            : 'Set INTEL_BASE_URL (e.g. http://127.0.0.1:8090) to enable Python intel',
          primary_engines: {
            confidence: 'api/_lib/confidenceEngine.js',
            multi_model: 'api/_lib/multiModel.js',
            grounding: 'api/_lib/grounding.js',
            chat_llm: 'api/chat.js (Gemini/Groq server-side only)',
          },
          python: {
            optional: true,
            ml_enabled: false,
            purpose: 'Future ML + shared deterministic intel; does not replace Node weather/chat',
          },
        })
      }

      if (!configured) {
        return send(res, 503, {
          ok: false,
          error: 'Python intelligence service not configured',
          code: 'intel_unconfigured',
        })
      }

      const path = OP_PATH[op]
      if (!path) {
        return send(res, 400, { ok: false, error: 'unknown op', code: 'bad_op', ops: Object.keys(OP_PATH) })
      }
      try {
        const { status, json } = await proxyRequest('GET', path, null, DEFAULT_TIMEOUT_MS)
        return send(res, status, json)
      } catch (e) {
        return send(res, e.code === 'timeout' ? 504 : 503, {
          ok: false,
          error: e.message || 'intel proxy failed',
          code: e.code || 'intel_proxy_error',
        })
      }
    }

    if (req.method !== 'POST') {
      return send(res, 405, { ok: false, error: 'GET or POST only', code: 'method_not_allowed' })
    }

    if (!configured) {
      return send(res, 503, {
        ok: false,
        error: 'Python intelligence service not configured (INTEL_BASE_URL)',
        code: 'intel_unconfigured',
        fallback: 'Use existing Node api/_lib engines',
      })
    }

    const body = await readJson(req)
    const op = body.op || body.operation
    const path = OP_PATH[op]
    if (!path) {
      return send(res, 400, {
        ok: false,
        error: 'body.op required',
        code: 'bad_op',
        ops: Object.keys(OP_PATH).filter((k) => k !== 'health' && k !== 'capabilities'),
      })
    }

    // Strip op before forwarding
    const { op: _o, operation: _op2, ...forward } = body
    const method = op === 'health' || op === 'capabilities' ? 'GET' : 'POST'
    const payload = method === 'POST' ? forward : null

    try {
      const { status, json } = await proxyRequest(method, path, payload, DEFAULT_TIMEOUT_MS)
      return send(res, status, json)
    } catch (e) {
      return send(res, e.code === 'timeout' ? 504 : 503, {
        ok: false,
        error: e.message || 'intel proxy failed',
        code: e.code || 'intel_proxy_error',
        fallback: 'Node confidenceEngine / multiModel remain available',
      })
    }
  } catch (e) {
    return send(res, 500, {
      ok: false,
      error: 'intel bff error',
      code: 'internal_error',
      detail: e.message || String(e),
    })
  }
}
