import { useState } from 'react'
import { Car, CloudSun, GraduationCap, MessageCircle, Sprout, ChevronRight } from 'lucide-react'

const SLIDES = [
  {
    icon: CloudSun,
    en: {
      title: 'Weather that decides with you',
      body: 'Not just temperature — grounded AI briefs for rain, alerts, farm, travel and school.',
    },
    hi: {
      title: 'मौसम जो आपके साथ फैसला करे',
      body: 'सिर्फ तापमान नहीं — बारिश, अलर्ट, खेती, यात्रा और स्कूल के लिए स्रोत-युक्त AI ब्रीफ।',
    },
  },
  {
    icon: MessageCircle,
    en: {
      title: 'Ask in Hindi or English',
      body: 'Full summaries with confidence scores. Unlimited city search. Live data when the network allows.',
    },
    hi: {
      title: 'हिंदी या अंग्रेज़ी में पूछें',
      body: 'पूरे सारांश + विश्वास स्कोर। असीमित शहर खोज। नेटवर्क हो तो लाइव डेटा।',
    },
  },
  {
    icon: Car,
    en: {
      title: 'Travel · School · Farm modes',
      body: 'Road-risk windows, heat/outdoor PE guidance, and irrigation advice — one product, three jobs.',
    },
    hi: {
      title: 'यात्रा · स्कूल · कृषि मोड',
      body: 'सड़क-जोखिम खिड़कियाँ, हीट/आउटडोर PT, और सिंचाई सलाह — एक प्रोडक्ट, तीन काम।',
    },
  },
]

export default function Onboarding({ lang = 'en', onDone }) {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  const Icon = s.icon
  const copy = lang === 'hi' ? s.hi : s.en
  const last = i === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[80] mesh-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-bubble">
        <div className="bg-gradient-to-br from-navy-900 to-navy-700 px-6 pt-8 pb-10 text-white relative">
          <div className="absolute right-4 top-4 flex gap-1">
            {SLIDES.map((_, idx) => (
              <span
                key={idx}
                className={`h-1 rounded-full transition-all ${idx === i ? 'w-6 bg-sun-400' : 'w-2 bg-white/30'}`}
              />
            ))}
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-sun-400" />
          </div>
          <p className="text-[11px] uppercase tracking-widest text-white/50 font-semibold">WeatherGPT</p>
          <h2 className="text-[22px] font-semibold leading-snug mt-1">{copy.title}</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-[14px] text-ink-600 leading-relaxed">{copy.body}</p>
          <div className="flex gap-2 mt-4 text-sky-400">
            <Sprout className="w-4 h-4" />
            <Car className="w-4 h-4" />
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="flex gap-2 mt-6">
            {!last && (
              <button
                type="button"
                onClick={onDone}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-ink-500 hover:bg-cloud-100"
              >
                {lang === 'hi' ? 'छोड़ें' : 'Skip'}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onDone() : setI((x) => x + 1))}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-navy-900 text-white text-[13px] font-semibold hover:bg-navy-700"
            >
              {last ? (lang === 'hi' ? 'शुरू करें' : 'Get started') : lang === 'hi' ? 'आगे' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
