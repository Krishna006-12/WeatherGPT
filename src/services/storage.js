/**
 * Persistent local storage — product-grade preferences & history
 */

const KEYS = {
  prefs: 'wgpt_prefs_v2',
  recent: 'weathergpt_recent_cities',
  history: 'wgpt_chat_history_v1',
  onboarding: 'wgpt_onboarded_v1',
  savedAlerts: 'wgpt_saved_alerts_v1',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* quota */
  }
}

export const defaultPrefs = {
  lang: 'en',
  units: 'C', // C | F
  defaultMode: 'travel', // farm | travel | school
  voiceLang: 'auto', // auto | en-IN | hi-IN
  notifyAlerts: true,
  notifyMinSeverity: 'yellow', // yellow | amber | red
  reducedMotion: false,
  homeCityId: 'kanpur',
}

export function loadPrefs() {
  return { ...defaultPrefs, ...read(KEYS.prefs, {}) }
}

export function savePrefs(prefs) {
  write(KEYS.prefs, prefs)
}

export function loadOnboarded() {
  return !!read(KEYS.onboarding, false)
}

export function setOnboarded() {
  write(KEYS.onboarding, true)
}

export function loadChatHistory(cityId) {
  const all = read(KEYS.history, {})
  return all[cityId] || null
}

export function saveChatHistory(cityId, messages) {
  const all = read(KEYS.history, {})
  // keep last 40 messages per city, strip heavy fields
  const slim = (messages || []).slice(-40).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    type: m.type,
    source: m.source,
    confidence: m.confidence,
    chips: m.chips,
    timestamp: m.timestamp,
  }))
  all[cityId] = slim
  // cap cities stored
  const ids = Object.keys(all)
  if (ids.length > 8) {
    ids.slice(0, ids.length - 8).forEach((k) => delete all[k])
  }
  write(KEYS.history, all)
}

export function clearChatHistory(cityId) {
  if (!cityId) {
    write(KEYS.history, {})
    return
  }
  const all = read(KEYS.history, {})
  delete all[cityId]
  write(KEYS.history, all)
}

export function loadSavedAlerts() {
  return read(KEYS.savedAlerts, [])
}

export function saveAlertBookmark(alert) {
  const list = loadSavedAlerts()
  const next = [{ ...alert, savedAt: Date.now() }, ...list.filter((a) => a.id !== alert.id)].slice(0, 30)
  write(KEYS.savedAlerts, next)
  return next
}

export function toDisplayTemp(celsius, units) {
  if (units === 'F') return Math.round((celsius * 9) / 5 + 32)
  return Math.round(celsius)
}

export function tempUnitLabel(units) {
  return units === 'F' ? '°F' : '°C'
}
