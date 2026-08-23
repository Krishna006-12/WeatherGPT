// API client - works with both local backend and Supabase
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function apiChat(message, language = 'en', location_hint) {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language, location_hint })
    })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    return data
  } catch (e) {
    console.log('Backend not available, using local mock:', e.message)
    return null // fallback to local mock
  }
}

export async function apiGetWeather(city) {
  try {
    const res = await fetch(`${API_BASE}/api/weather/${city}`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch {
    return null
  }
}

export async function apiGetAlerts(city) {
  try {
    const res = await fetch(`${API_BASE}/api/alerts?city=${city}&active=true`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch {
    return null
  }
}

export async function apiGetLocations() {
  try {
    const res = await fetch(`${API_BASE}/api/locations`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch {
    return null
  }
}

export async function apiSimulateAlert(city_key = 'mumbai') {
  try {
    const res = await fetch(`${API_BASE}/api/alerts/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city_key, severity: 'red', title: 'Simulated Red Alert' })
    })
    return await res.json()
  } catch {
    return null
  }
}

export const isBackendConfigured = () => {
  return !!import.meta.env.VITE_API_URL || window.location.hostname === 'localhost'
}
