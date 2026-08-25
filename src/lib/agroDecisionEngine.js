// Gramin Krishi Mausam Decision Engine (ICAR / IMD Agromet Aligned)

export function evaluateAgroAdvisory(weatherData, lang = 'en') {
  if (!weatherData) return null

  const current = weatherData.current
  const today = weatherData.daily?.[0] || {}
  const tomorrow = weatherData.daily?.[1] || {}
  const next3DaysRain = (weatherData.daily || []).slice(0, 3).reduce((acc, d) => acc + (d.rainSum || 0), 0)
  const soilMoisture = weatherData.agri?.soilMoisture0_7 || 0.25
  const windSpeed = current.windSpeed || 10

  // 1. Irrigation Decision Logic
  let irrigationCode = 'hold'
  let irrigationTitle_en = 'Hold Irrigation for 48–72 Hours'
  let irrigationTitle_hi = 'अगले 48-72 घंटों के लिए सिंचाई रोकें'
  let irrigationReason_en = `Rain expected (~${tomorrow.rainSum || 15}mm, ${tomorrow.pop}% probability). Adequate root-zone moisture.`
  let irrigationReason_hi = `कल ~${tomorrow.rainSum || 15}mm बारिश (${tomorrow.pop}% संभावना) का अनुमान है। भूमि में पर्याप्त नमी मौजूद है।`

  if (next3DaysRain < 3.0 && soilMoisture < 0.20) {
    irrigationCode = 'irrigate_now'
    irrigationTitle_en = 'Irrigate Immediately (Deficit Detected)'
    irrigationTitle_hi = 'तुरंत हल्की सिंचाई करें (नमी की कमी)'
    irrigationReason_en = `Dry spell next 5 days. Root-zone soil moisture is low (${Math.round(soilMoisture * 100)}%).`
    irrigationReason_hi = `अगले 5 दिनों में बारिश नहीं है। मिट्टी की नमी कम है (${Math.round(soilMoisture * 100)}%)।`
  } else if (next3DaysRain > 35.0 || soilMoisture > 0.38) {
    irrigationCode = 'drainage'
    irrigationTitle_en = 'Ensure Field Drainage (Waterlogging Risk)'
    irrigationTitle_hi = 'खेत में जल निकासी सुनिश्चित करें (जलभराव का खतरा)'
    irrigationReason_en = `Excessive rainfall forecasted (${next3DaysRain.toFixed(1)}mm). Protect root aeration.`
    irrigationReason_hi = `भारी बारिश का अनुमान (${next3DaysRain.toFixed(1)}mm)। फसलों को जलभराव से बचाने के लिए नालियां साफ रखें।`
  } else if (tomorrow.pop < 30 && soilMoisture >= 0.20 && soilMoisture <= 0.32) {
    irrigationCode = 'light_irrigation'
    irrigationTitle_en = 'Light Morning Irrigation Permitted'
    irrigationTitle_hi = 'सुबह के समय हल्की सिंचाई कर सकते हैं'
    irrigationReason_en = 'Low rain probability and moderate ET rate. Drip or light furrow irrigation advised.'
    irrigationReason_hi = 'बारिश का जोखिम कम है। ड्रिप या हल्की क्यारी विधि से सिंचाई करें।'
  }

  // 2. Pesticide / Fertilizer Spray Window
  let sprayCode = 'favourable'
  let sprayTitle_en = 'Safe Spraying Window (Morning 7 AM – 11 AM)'
  let sprayTitle_hi = 'छिड़काव के लिए अनुकूल समय (सुबह 7 से 11 बजे)'
  let sprayReason_en = `Wind speed is calm (${windSpeed} km/h) and rain probability is low (<35%). Minimum chemical drift.`
  let sprayReason_hi = `हवा की गति शांत है (${windSpeed} km/h) और बारिश का जोखिम कम है। दवा व्यर्थ नहीं होगी।`

  if (windSpeed > 15 || tomorrow.pop > 50 || current.precipitation > 0) {
    sprayCode = 'unfavourable'
    sprayTitle_en = 'Postpone Spraying / Chemical Treatment'
    sprayTitle_hi = 'कीटनाशक व खाद का छिड़काव अभी टालें'
    sprayReason_en = `High wind (${windSpeed} km/h) or high rain chance (${tomorrow.pop}%) causes chemical wash-off and drift.`
    sprayReason_hi = `तेज हवा (${windSpeed} km/h) या बारिश (${tomorrow.pop}%) के कारण दवा धुलने और बहने का खतरा है।`
  }

  // 3. Livestock & Standing Crop Heat Stress
  const maxTemp = today.maxTemp || 32
  let heatStress_en = 'Normal / Low Stress'
  let heatStress_hi = 'सामान्य स्थिति'
  if (maxTemp >= 40) {
    heatStress_en = 'Severe Heatwave Stress: Provide shade, cool drinking water & mulching'
    heatStress_hi = 'गंभीर लू का तनाव: पशुओं को छायादार स्थान पर रखें, फसलों में मल्चिंग करें'
  } else if (maxTemp >= 36) {
    heatStress_en = 'Moderate Heat Stress: Increase watering frequency'
    heatStress_hi = 'मध्यम ताप तनाव: समय पर हल्का पानी दें'
  }

  return {
    irrigation: {
      code: irrigationCode,
      title: lang === 'hi' ? irrigationTitle_hi : irrigationTitle_en,
      reason: lang === 'hi' ? irrigationReason_hi : irrigationReason_en,
      statusColor: irrigationCode === 'drainage' ? '#B3261E' : irrigationCode === 'hold' ? '#C97A1A' : '#2E7D5B'
    },
    spray: {
      code: sprayCode,
      title: lang === 'hi' ? sprayTitle_hi : sprayTitle_en,
      reason: lang === 'hi' ? sprayReason_hi : sprayReason_en,
      statusColor: sprayCode === 'favourable' ? '#2E7D5B' : '#B3261E'
    },
    heatStress: {
      level: lang === 'hi' ? heatStress_hi : heatStress_en
    },
    metrics: {
      soil0_7: weatherData.agri?.soilMoisture0_7 || 0.25,
      soil7_28: weatherData.agri?.soilMoisture7_28 || 0.31,
      et0: weatherData.agri?.dailyEt0 || 3.8,
      next3DaysRain: Number(next3DaysRain.toFixed(1))
    }
  }
}
