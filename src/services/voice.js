/**
 * Voice I/O — STT helpers + TTS for rural accessibility (SIH)
 */

export function speechRecognitionSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function ttsSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis
}

export function pickVoice(lang = 'en') {
  if (!ttsSupported()) return null
  const voices = window.speechSynthesis.getVoices?.() || []
  const prefer =
    lang === 'hi'
      ? [/hi-IN/i, /hindi/i, /hi_/i]
      : [/en-IN/i, /en-GB/i, /en-US/i, /english/i]
  for (const re of prefer) {
    const v = voices.find((x) => re.test(x.lang) || re.test(x.name))
    if (v) return v
  }
  return voices[0] || null
}

/** Strip markdown noise for cleaner speech */
export function plainForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\|+/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/[•·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}

let speaking = false

export function stopSpeaking() {
  if (!ttsSupported()) return
  window.speechSynthesis.cancel()
  speaking = false
}

export function speakText(text, { lang = 'en', rate = 0.95 } = {}) {
  if (!ttsSupported()) return { ok: false, reason: 'unsupported' }
  const plain = plainForSpeech(text)
  if (!plain) return { ok: false, reason: 'empty' }

  stopSpeaking()
  const u = new SpeechSynthesisUtterance(plain)
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  u.rate = rate
  const voice = pickVoice(lang)
  if (voice) u.voice = voice
  speaking = true
  u.onend = () => {
    speaking = false
  }
  u.onerror = () => {
    speaking = false
  }
  const run = () => window.speechSynthesis.speak(u)
  if (!(window.speechSynthesis.getVoices() || []).length) {
    window.speechSynthesis.onvoiceschanged = () => {
      const v = pickVoice(lang)
      if (v) u.voice = v
      run()
    }
    setTimeout(run, 250)
  } else {
    run()
  }
  return { ok: true }
}

export function isSpeaking() {
  return speaking || (ttsSupported() && window.speechSynthesis.speaking)
}
