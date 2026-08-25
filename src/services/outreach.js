/**
 * Rural outreach helpers — SMS / WhatsApp / IVR script
 * Does NOT send bulk SMS itself (needs MSG91/Twilio + DLT).
 * Gives relay-ready text for humans and personal sms: links.
 */

export function alertSmsBody(alert, { lang = 'en', place = '' } = {}) {
  const city = place || alert.place || ''
  const sev = String(alert.severity || '').toUpperCase()
  const title = lang === 'hi' ? alert.title_hi || alert.title : alert.title
  const summary = lang === 'hi' ? alert.summary_hi || alert.summary : alert.summary
  const means = lang === 'hi' ? alert.meansForYou_hi || alert.meansForYou : alert.meansForYou

  if (lang === 'hi') {
    return (
      `WeatherGPT ${sev} अलर्ट${city ? ' · ' + city : ''}\n` +
      `${title}\n` +
      `${summary || ''}\n` +
      `आपके लिए: ${means || 'आधिकारिक सलाह देखें'}\n` +
      `स्रोत: ${alert.source || 'model'} · ऐप/स्वयंसेवक रिले`
    ).slice(0, 600)
  }
  return (
    `WeatherGPT ${sev} alert${city ? ' · ' + city : ''}\n` +
    `${title}\n` +
    `${summary || ''}\n` +
    `For you: ${means || 'Follow official guidance'}\n` +
    `Source: ${alert.source || 'model'} · app/volunteer relay`
  ).slice(0, 600)
}

export function alertIvrScript(alert, { lang = 'en', place = '' } = {}) {
  const city = place || alert.place || 'your area'
  const title = lang === 'hi' ? alert.title_hi || alert.title : alert.title
  const means = lang === 'hi' ? alert.meansForYou_hi || alert.meansForYou : alert.meansForYou
  if (lang === 'hi') {
    return (
      `IVR / लाउडस्पीकर स्क्रिप्ट:\n` +
      `नमस्ते। यह ${city} के लिए WeatherGPT मौसम सूचना है।\n` +
      `चेतावनी स्तर: ${String(alert.severity || '').toUpperCase()}.\n` +
      `विवरण: ${title}.\n` +
      `कृपया करें: ${means || 'सुरक्षित स्थान पर रहें और स्थानीय प्रशासन की सुनें'}.\n` +
      `यह आधिकारिक IMD ज़िला बुलेटिन का विकल्प नहीं। दोहराएँ।`
    )
  }
  return (
    `IVR / loudspeaker script:\n` +
    `Hello. This is a WeatherGPT weather notice for ${city}.\n` +
    `Severity: ${String(alert.severity || '').toUpperCase()}.\n` +
    `Detail: ${title}.\n` +
    `Please: ${means || 'Stay safe and follow local administration'}.\n` +
    `This is not a substitute for official IMD district bulletins. Repeat once.`
  )
}

export function smsLink(body, phone = '') {
  const q = encodeURIComponent(body)
  // iOS uses &body= , Android often ?body=
  if (phone) return `sms:${phone}?body=${q}`
  return `sms:?body=${q}`
}

export function whatsappShareLink(body) {
  return `https://wa.me/?text=${encodeURIComponent(body)}`
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export async function shareOrCopy(text, title = 'WeatherGPT Alert') {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch {
      /* cancel */
    }
  }
  return copyText(text)
}
