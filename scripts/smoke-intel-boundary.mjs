/**
 * Boundary smoke: /api/intel BFF responds without Python (unconfigured path).
 * Does not require Python running.
 */
import handler from '../api/intel.js'
import { EventEmitter } from 'node:events'

function mockRes() {
  const ee = new EventEmitter()
  ee.statusCode = 200
  ee.headers = {}
  ee.body = ''
  ee.setHeader = (k, v) => {
    ee.headers[k] = v
  }
  ee.end = (s) => {
    ee.body = s || ''
    ee.emit('done')
  }
  return ee
}

function mockReq(method, url = '/api/intel') {
  const ee = new EventEmitter()
  ee.method = method
  ee.url = url
  ee.headers = {}
  ee.body = undefined
  return ee
}

const req = mockReq('GET')
const res = mockRes()
await new Promise((resolve) => {
  res.on('done', resolve)
  handler(req, res)
})
const j = JSON.parse(res.body)
if (!j.ok || j.service !== 'weathergpt-intel-bff') {
  console.error('FAIL bff status', j)
  process.exit(1)
}
if (j.configured !== false && !process.env.INTEL_BASE_URL) {
  console.error('FAIL expected unconfigured', j)
  process.exit(1)
}
if (!j.primary_engines?.chat_llm) {
  console.error('FAIL missing primary_engines')
  process.exit(1)
}
console.log('PASS intel BFF status (python optional)')
console.log(JSON.stringify({ configured: j.configured, ops: j.ops }, null, 2))
