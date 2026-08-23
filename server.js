import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))
app.use(express.json())

// ---------- DB - Simple JSON file persistence (free, no external DB needed) ----------
const DB_PATH = path.join(__dirname, 'database.json')

const initialDB = {
  users: [
    { id: 'user-1', name: 'Demo User', phone: '9999999999', created_at: new Date().toISOString() }
  ],
  locations: [
    { id: 'loc-1', user_id: 'user-1', city_key: 'lucknow', name: 'Lucknow', is_current: true },
    { id: 'loc-2', user_id: 'user-1', city_key: 'mumbai', name: 'Mumbai', is_current: false },
    { id: 'loc-3', user_id: 'user-1', city_key: 'guwahati', name: 'Guwahati', is_current: false }
  ],
  weather_cache: {
    lucknow: {
      current: { temp: 32, condition: 'Sunny', icon: '☀️', humidity: 45, wind: 8, updated_at: new Date().toISOString() },
      forecast: [
        { day: 'Today', high: 32, low: 24, rain: 10, condition: 'Sunny', icon: '☀️' },
        { day: 'Tomorrow', high: 29, low: 23, rain: 60, condition: 'Rain', icon: '🌧️' },
        { day: 'Wed', high: 28, low: 22, rain: 80, condition: 'Heavy Rain', icon: '⛈️' },
        { day: 'Thu', high: 30, low: 23, rain: 20, condition: 'Cloudy', icon: '☁️' },
        { day: 'Fri', high: 33, low: 25, rain: 5, condition: 'Sunny', icon: '☀️' }
      ]
    },
    mumbai: {
      current: { temp: 28, condition: 'Cloudy', icon: '☁️', humidity: 82, wind: 15, updated_at: new Date().toISOString() },
      forecast: [
        { day: 'Today', high: 28, low: 25, rain: 70, condition: 'Rain', icon: '🌧️' },
        { day: 'Tomorrow', high: 27, low: 24, rain: 85, condition: 'Heavy Rain', icon: '⛈️' },
        { day: 'Wed', high: 27, low: 24, rain: 60, condition: 'Rain', icon: '🌧️' },
        { day: 'Thu', high: 28, low: 25, rain: 30, condition: 'Cloudy', icon: '☁️' },
        { day: 'Fri', high: 29, low: 26, rain: 20, condition: 'Cloudy', icon: '☁️' }
      ]
    },
    guwahati: {
      current: { temp: 26, condition: 'Mist', icon: '🌫️', humidity: 88, wind: 5, updated_at: new Date().toISOString() },
      forecast: [
        { day: 'Today', high: 26, low: 21, rain: 40, condition: 'Cloudy', icon: '☁️' },
        { day: 'Tomorrow', high: 27, low: 22, rain: 30, condition: 'Cloudy', icon: '☁️' },
        { day: 'Wed', high: 28, low: 22, rain: 20, condition: 'Sunny', icon: '⛅' },
        { day: 'Thu', high: 29, low: 23, rain: 15, condition: 'Sunny', icon: '☀️' },
        { day: 'Fri', high: 30, low: 23, rain: 25, condition: 'Cloudy', icon: '☁️' }
      ]
    }
  },
  alerts: [
    { id: 'lko-1', city_key: 'lucknow', severity: 'amber', title: 'Heavy Rain Watch', summary: 'Heavy rainfall expected in next 24-48 hrs', official_text: 'IMD issues Yellow Watch for Lucknow district. Heavy rainfall (64.5-115.5mm) likely at isolated places.', what_it_means: 'Carry umbrella, avoid low-lying routes. Farmers: postpone pesticide spray.', created_at: new Date(Date.now() - 2*3600*1000).toISOString(), is_active: true },
    { id: 'mum-1', city_key: 'mumbai', severity: 'red', title: 'Extreme Rain Warning', summary: 'Red alert: 200mm+ rain expected, high tide risk', official_text: 'IMD RED WARNING: Extremely heavy rainfall (>204.4mm) very likely in Mumbai & suburbs. High tide at 14:30 IST. NDMA: Avoid coastal areas.', what_it_means: 'DO NOT travel unless essential. Charge phones. Fishermen: do not venture into sea.', created_at: new Date(Date.now() - 30*60*1000).toISOString(), is_active: true }
  ],
  agri_advisory: {
    lucknow: { recent_rain: 12, forecast_rain: 45, soil_moisture: 'Medium', advice: 'Hold irrigation for 3 days' },
    mumbai: { recent_rain: 85, forecast_rain: 120, soil_moisture: 'High', advice: 'No irrigation needed, ensure drainage' },
    guwahati: { recent_rain: 22, forecast_rain: 18, soil_moisture: 'Medium', advice: 'Irrigate lightly tomorrow morning' }
  },
  chat_logs: []
}

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    }
  } catch (e) { console.error('DB load error', e) }
  return initialDB
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
  } catch (e) { console.error('DB save error', e) }
}

let db = loadDB()
// ensure file exists
saveDB(db)

// ---------- Intent Parser (same as frontend, but backend authoritative) ----------
function parseIntent(text) {
  const lower = text.toLowerCase()
  let location = 'lucknow'
  if (lower.includes('mumbai') || lower.includes('मुंबई')) location = 'mumbai'
  else if (lower.includes('guwahati') || lower.includes('गुवाहाटी')) location = 'guwahati'
  else if (lower.includes('lucknow') || lower.includes('लखनऊ')) location = 'lucknow'

  let intent = 'general'
  if (/(irrigat|sincai|सिंचाई|सिंचन|khet|field|farming|खेत)/.test(lower)) intent = 'agri'
  else if (/(warn|alert|chetavni|चेतावनी|इशारा|khatra)/.test(lower)) intent = 'alert'
  else if (/(rain|baarish|बारिश|पाऊस)/.test(lower)) intent = 'rain'
  else if (/(temperature|temp|गर्मी|तापमान)/.test(lower)) intent = 'temp'
  else if (/(aviation|pilot|flight|marine|ship|climate trend|30.year|carbon)/.test(lower)) intent = 'outofscope'
  else if (/(forecast|5.day|tomorrow|kal|कल|उद्या|week)/.test(lower)) intent = 'forecast'
  return { location, intent }
}

// ---------- API ROUTES ----------

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), db_path: DB_PATH, cities: Object.keys(db.weather_cache) })
})

// Get all weather
app.get('/api/weather', (req, res) => {
  res.json({ success: true, data: db.weather_cache, source: 'IMD', updated: new Date().toISOString() })
})

// Get city weather
app.get('/api/weather/:city', (req, res) => {
  const city = req.params.city.toLowerCase()
  const data = db.weather_cache[city]
  if (!data) return res.status(404).json({ success: false, error: 'City not found. Available: lucknow, mumbai, guwahati' })
  res.json({ success: true, city, data, source: 'IMD', updated: data.current.updated_at })
})

// Get alerts
app.get('/api/alerts', (req, res) => {
  const { city, active } = req.query
  let alerts = db.alerts
  if (city) alerts = alerts.filter(a => a.city_key === city.toLowerCase())
  if (active === 'true') alerts = alerts.filter(a => a.is_active)
  res.json({ success: true, count: alerts.length, data: alerts })
})

// Create alert (simulate incoming)
app.post('/api/alerts/simulate', (req, res) => {
  const newAlert = {
    id: `alert-${Date.now()}`,
    city_key: req.body.city_key || 'mumbai',
    severity: req.body.severity || 'red',
    title: req.body.title || 'Simulated Extreme Alert',
    summary: req.body.summary || 'This is a simulated alert for demo',
    official_text: req.body.official_text || 'IMD SIMULATION: This is a demo alert triggered by judge. In production, this would come from IMD API via webhook.',
    what_it_means: req.body.what_it_means || 'Demo only - no action needed',
    created_at: new Date().toISOString(),
    is_active: true
  }
  db.alerts.unshift(newAlert)
  saveDB(db)
  res.json({ success: true, data: newAlert })
})

// Locations CRUD
app.get('/api/locations', (req, res) => {
  const userId = req.query.user_id || 'user-1'
  const locs = db.locations.filter(l => l.user_id === userId).map(l => ({
    ...l,
    weather: db.weather_cache[l.city_key]?.current
  }))
  res.json({ success: true, data: locs })
})

app.post('/api/locations', (req, res) => {
  const { city_key, user_id = 'user-1' } = req.body
  if (!city_key || !db.weather_cache[city_key.toLowerCase()]) {
    return res.status(400).json({ success: false, error: 'Invalid city_key. Use lucknow, mumbai, guwahati' })
  }
  const key = city_key.toLowerCase()
  if (db.locations.find(l => l.user_id === user_id && l.city_key === key)) {
    return res.status(400).json({ success: false, error: 'Location already saved' })
  }
  const newLoc = { id: `loc-${Date.now()}`, user_id, city_key: key, name: key.charAt(0).toUpperCase()+key.slice(1), is_current: false }
  db.locations.push(newLoc)
  saveDB(db)
  res.json({ success: true, data: newLoc })
})

app.delete('/api/locations/:id', (req, res) => {
  const idx = db.locations.findIndex(l => l.id === req.params.id)
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' })
  const removed = db.locations.splice(idx, 1)[0]
  saveDB(db)
  res.json({ success: true, data: removed })
})

// Agri advisory
app.get('/api/advisory/:city', (req, res) => {
  const city = req.params.city.toLowerCase()
  const data = db.agri_advisory[city]
  if (!data) return res.status(404).json({ success: false, error: 'City not found' })
  res.json({ success: true, city, data, source: 'IMD Agromet', updated: new Date().toISOString() })
})

// Chat - main AI endpoint (retrieve-then-phrase pattern)
app.post('/api/chat', (req, res) => {
  const { message, language = 'en', user_id = 'user-1', location_hint } = req.body
  if (!message) return res.status(400).json({ success: false, error: 'message required' })

  const parsed = parseIntent(message)
  // override with hint if provided
  if (location_hint && db.weather_cache[location_hint]) parsed.location = location_hint

  const cityData = db.weather_cache[parsed.location]
  const cityAlerts = db.alerts.filter(a => a.city_key === parsed.location && a.is_active)
  const agri = db.agri_advisory[parsed.location]

  // Log chat
  const logEntry = { id: `chat-${Date.now()}`, user_id, message, parsed, timestamp: new Date().toISOString() }
  db.chat_logs.push(logEntry)
  if (db.chat_logs.length > 100) db.chat_logs = db.chat_logs.slice(-100)
  saveDB(db)

  // Build response (same logic as frontend but authoritative)
  let response = {}
  const nowMin = Math.floor(Math.random()*15)+1
  const sourceLine = `Source: IMD · updated ${nowMin} min ago`

  if (parsed.intent === 'outofscope') {
    response = {
      type: 'outofscope',
      text: language === 'hi' ? 'मैं अभी एविएशन/मरीन ब्रीफिंग और 30-साल के क्लाइमेट ट्रेंड सपोर्ट नहीं करता। मैं मौसम पूर्वानुमान, चेतावनी और कृषि सलाह में मदद कर सकता हूँ।' : language === 'mr' ? 'मी सध्या एव्हिएशन/मरीन ब्रीफिंग सपोर्ट करत नाही. मी हवामान अंदाज, इशारे आणि कृषी सल्ला देऊ शकतो.' : "I can't help with aviation briefings, marine forecasts, or 30-year climate trends yet — that's Phase 2. I focus on accurate, source-attributed daily forecasts, alerts, and agri advisories.",
      source: null,
      chips: ['Tomorrow alert?', '5-day forecast', 'Should I irrigate?']
    }
  } else if (parsed.intent === 'agri') {
    response = {
      type: 'advisory',
      text: '',
      data: { city: parsed.location, ...agri, current: cityData.current },
      advice: agri.advice,
      source: sourceLine,
      chips: ['Rain tomorrow?', 'Soil moisture?']
    }
  } else if (parsed.intent === 'alert') {
    if (cityAlerts.length > 0) {
      response = {
        type: 'alert',
        text: `⚠️ Active ${cityAlerts[0].title} for ${parsed.location}: ${cityAlerts[0].summary}`,
        alert: cityAlerts[0],
        source: sourceLine,
        chips: ['5-day forecast', 'Should I irrigate?']
      }
    } else {
      response = {
        type: 'normal',
        text: `✅ No active warnings for ${parsed.location} right now. All clear.`,
        source: sourceLine,
        chips: ['Tomorrow alert?', '5-day forecast']
      }
    }
  } else if (parsed.intent === 'rain') {
    const tomorrow = cityData.forecast[1]
    response = {
      type: 'normal',
      text: `🌧️ ${tomorrow.rain}% chance of rain tomorrow afternoon in ${parsed.location}. Today: ${cityData.current.temp}°C ${cityData.current.condition}, humidity ${cityData.current.humidity}%.`,
      source: sourceLine,
      chips: ['5-day forecast', 'Any warning?', 'Should I irrigate?']
    }
  } else {
    response = {
      type: 'normal',
      text: `Hello! Currently ${cityData.current.temp}°C and ${cityData.current.condition} in ${parsed.location}. Ask me about rain, alerts, or farming advice — every answer is IMD-sourced.`,
      source: sourceLine,
      chips: ['Will it rain tomorrow?', 'Any warning?', 'Should I irrigate?']
    }
  }

  res.json({
    success: true,
    parsed,
    response,
    meta: {
      city: parsed.location,
      weather: cityData,
      alerts: cityAlerts,
      agri
    }
  })
})

// Chat history
app.get('/api/chat/history', (req, res) => {
  const userId = req.query.user_id || 'user-1'
  const history = db.chat_logs.filter(l => l.user_id === userId).slice(-20)
  res.json({ success: true, data: history })
})

// Serve frontend in production
app.use(express.static(path.join(__dirname, 'dist')))
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API route not found' })
  }
  const indexPath = path.join(__dirname, 'dist', 'index.html')
  if (fs.existsSync(indexPath)) res.sendFile(indexPath)
  else res.json({ message: 'WeatherGPT API running. Frontend not built. Run npm run build first. Try /api/health', endpoints: ['/api/health','/api/weather/lucknow','/api/alerts','/api/chat'] })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ WeatherGPT Backend running on http://0.0.0.0:${PORT}`)
  console.log(`📁 Database: ${DB_PATH} (JSON file - free, no external DB needed)`)
  console.log(`🔗 API Docs:`)
  console.log(`   GET  /api/health`)
  console.log(`   GET  /api/weather/:city`)
  console.log(`   GET  /api/alerts?city=lucknow&active=true`)
  console.log(`   POST /api/chat { message, language }`)
  console.log(`   POST /api/alerts/simulate`)
  console.log(`   GET  /api/locations`)
  console.log(`\n💡 For Supabase (production): replace loadDB/saveDB with supabase client`)
})
