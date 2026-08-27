// Disaster Management & Rural Multi-Channel Relay Engine

export const INITIAL_SAMPLE_ALERTS = [
  {
    id: 'alt-mum-red',
    cityKey: 'mumbai',
    cityName: 'Mumbai',
    severity: 'red',
    title: 'Extremely Heavy Rainfall & High Tide Warning',
    title_hi: 'अत्यधिक भारी बारिश एवं हाई टाइड चेतावनी (रेड अलर्ट)',
    issuedBy: 'IMD Mumbai / NDMA',
    summary: 'Rainfall exceeding 200mm likely in 24h. High tide of 4.4m expected at 14:30 IST.',
    summary_hi: '24 घंटे में 200mm+ बारिश की संभावना। दोपहर 14:30 पर 4.4m की उच्च ज्वार का खतरा।',
    time: '25 min ago',
    sms_en: 'IMD RED ALERT Mumbai: >200mm rain + 4.4m high tide today. Avoid low areas. Helplines: 1916 / 112. Pls stay safe. -Disaster Mgmt',
    sms_hi: 'IMD रेड अलर्ट मुंबई: आज 200mm+ भारी बारिश व हाई टाइड। जलभराव वाले क्षेत्रों से बचें। हेल्पलाइन 1916 / 112। -आपदा प्रबंधन',
    ivrScript_hi: 'सावधान! यह जिला आपदा प्रबंधन नियंत्रण कक्ष का आपातकालीन संदेश है। मुंबई जिले के लिए रेड अलर्ट जारी किया गया है। अगले चौबीस घंटों में भारी बारिश और समुद्र में ऊंची लहरों का खतरा है। निचले इलाकों के नागरिक सुरक्षित स्थानों पर रहें। मछुआरे समुद्र में न जाएं। आपातकालीन हेल्पलाइन 1916 पर संपर्क करें।',
    whatItMeans: 'DO NOT travel unless critical. Keep mobile phones charged. Fishermen must not venture into the sea.',
    whatItMeans_hi: 'अति आवश्यक होने पर ही बाहर निकलें। मोबाइल चार्ज रखें। मछुआरे समुद्र की ओर न जाएं।'
  },
  {
    id: 'alt-lko-amber',
    cityKey: 'lucknow',
    cityName: 'Lucknow',
    severity: 'amber',
    title: 'Severe Thunderstorm & Squall Watch (Amber)',
    title_hi: 'तीव्र आंधी-तूफान एवं वज्रपात चेतावनी (ऑरेंज अलर्ट)',
    issuedBy: 'IMD Lucknow Center',
    summary: 'Thunderstorms with gusty winds (50-60 km/h) & lightning strikes expected in next 12h.',
    summary_hi: 'अगले 12 घंटों में 50-60 किमी/घंटा तेज हवाएं एवं आकाशीय बिजली चमकने की संभावना।',
    time: '1 hour ago',
    sms_en: 'IMD ORANGE WATCH Lucknow: Thunderstorms & lightning likely in 12h. Avoid standing under trees/tin sheds. -Agromet',
    sms_hi: 'IMD ऑरेंज अलर्ट लखनऊ: अगले 12 घंटे में तेज आंधी व बिजली का खतरा। पेड़ों के नीचे खड़े न हों। -कृषि मौसम',
    ivrScript_hi: 'कृषक भाइयों और ग्रामीण नागरिकों ध्यान दें। लखनऊ क्षेत्र में आंधी और बिजली गिरने का अलर्ट है। खेतों में काम कर रहे किसान तुरंत पक्के मकानों में शरण लें। पेड़ या बिजली के खंभे के नीचे न खड़े हों।',
    whatItMeans: 'Stay indoors during lightning. Farmers: immediately stop open-field work and spraying.',
    whatItMeans_hi: 'बिजली चमकने के दौरान पक्के आश्रय में रहें। खुले खेत में काम तुरंत रोकें।'
  }
]

// Play simulated emergency chime using Web Audio API
export function playAlertChime(severity = 'red') {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.type = severity === 'red' ? 'sawtooth' : 'sine'
    osc.frequency.setValueAtTime(severity === 'red' ? 880 : 587, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(severity === 'red' ? 440 : 880, audioCtx.currentTime + 0.4)

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start()
    osc.stop(audioCtx.currentTime + 0.6)
  } catch (e) {
    console.log('AudioContext not available:', e.message)
  }
}

// Generate customizable district broadcast payload
export function createSimulatedAlert(city, severity = 'red') {
  const alertId = `alt-${city.key}-${Date.now()}`
  const nowStr = 'Just now'
  
  if (severity === 'red') {
    return {
      id: alertId,
      cityKey: city.key,
      cityName: city.name,
      severity: 'red',
      title: `FLASH FLOOD & CLOUDBURST WARNING · ${city.name.toUpperCase()}`,
      title_hi: `${city.name_hi || city.name} हेतु आकस्मिक बाढ़ एवं अतिवृष्टि चेतावनी (रेड अलर्ट)`,
      issuedBy: 'State Disaster Management Authority (SDMA) / IMD',
      summary: `Immediate Red Warning for ${city.name} district: Intense cloudburst radar signature detected (>75mm/hr).`,
      summary_hi: `${city.name_hi || city.name} जिले के लिए तत्काल रेड अलर्ट: अत्यधिक तीव्र वर्षा मेघ दर्ज किए गए हैं।`,
      time: nowStr,
      sms_en: `URGENT SDMA RED ALERT ${city.name}: Heavy cloudburst risk. Move to high ground immediately. Emergency: 112 / 1077. -Control Room`,
      sms_hi: `अति-महत्वपूर्ण रेड अलर्ट ${city.name_hi || city.name}: भारी जलभराव का खतरा। तुरंत ऊंचे सुरक्षित स्थानों पर जाएं। हेल्पलाइन: 112/1077।`,
      ivrScript_hi: `अति-महत्वपूर्ण सूचना! जिला मजिस्ट्रेट कार्यालय द्वारा ${city.name_hi || city.name} क्षेत्र में आपातकालीन रेड अलर्ट घोषित किया गया है। अगले कुछ घंटों में अत्यधिक तेज वर्षा और जलभराव का खतरा है। नदी और नालों के किनारे से तुरंत दूर हटें और सुरक्षित स्थानों पर पहुंचें। सहायता के लिए डायल 112 करें।`,
      whatItMeans: 'Evacuate low lying stream banks. Move livestock to elevated shelters. Keep emergency bag ready.',
      whatItMeans_hi: 'निचले क्षेत्रों से तुरंत सुरक्षित स्थान पर जाएं। मवेशियों को ऊंचे चबूतरे पर बांधें। टॉर्च व दवाएं साथ रखें।'
    }
  } else {
    return {
      id: alertId,
      cityKey: city.key,
      cityName: city.name,
      severity: 'amber',
      title: `Severe Weather & Gusty Winds Advisory · ${city.name}`,
      title_hi: `${city.name_hi || city.name} के लिए तेज हवाएं व आंधी चेतावनी`,
      issuedBy: 'Regional Meteorological Center',
      summary: `Strong squally winds (45-55 km/h) and scattered rain expected.`,
      summary_hi: `45-55 किमी/घंटे की गति से तेज हवाएं चलने का अनुमान है।`,
      time: nowStr,
      sms_en: `IMD AMBER ALERT ${city.name}: Strong squalls (55km/h) today. Secure loose roofs, farm sheds. Helpline 112.`,
      sms_hi: `ऑरेंज अलर्ट ${city.name_hi || city.name}: आज 55 किमी/घंटे तेज हवाएं। टीन शेड व फसल को सुरक्षित करें।`,
      ivrScript_hi: `ग्रामीण भाइयों ध्यान दें। ${city.name_hi || city.name} क्षेत्र में तेज हवाओं और आंधी का अलर्ट है। कच्चे छप्पर और सोलर पैनल सुरक्षित करें।`,
      whatItMeans: 'Secure outdoor equipment. Postpone pesticide spraying.',
      whatItMeans_hi: 'बाहर रखे कृषि उपकरण सुरक्षित करें। कीटनाशक छिड़काव रोकें।'
    }
  }
}
