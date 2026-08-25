import React, { useState } from 'react'
import { speakText, stopSpeaking } from '../lib/aiCopilot.js'

export default function RuralRelayModal({ alert, onClose, lang = 'en' }) {
  const [copiedType, setCopiedType] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  if (!alert) return null

  const smsText = lang === 'hi' ? alert.sms_hi : alert.sms_en
  const ivrScript = alert.ivrScript_hi || alert.summary

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  const handlePlayAudio = () => {
    if (isPlayingAudio) {
      stopSpeaking()
      setIsPlayingAudio(false)
    } else {
      setIsPlayingAudio(true)
      speakText(ivrScript, 'hi')
      setTimeout(() => setIsPlayingAudio(false), 14000)
    }
  }

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`🚨 *WEATHERGPT EMERGENCY DISPATCH* 🚨\n\n*${alert.title}*\n${alert.summary}\n\n*Safety Actions:* ${alert.whatItMeans}\n\nEmergency Helpline: 112 / 1077`)}`

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-4 animate-slideUp">
      <div className="bg-white border border-cloud-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between ${alert.severity === 'red' ? 'bg-alert-red' : 'bg-alert-amber'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <div className="text-xs uppercase tracking-widest font-mono opacity-90">Rural Multi-Channel Relay Studio</div>
              <h2 className="text-lg font-bold leading-tight">{alert.title}</h2>
            </div>
          </div>
          <button onClick={() => { stopSpeaking(); onClose(); }} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold">✕</button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-ink-800 text-sm">
          {/* Situation Context */}
          <div className="bg-monsoon-100 border border-cloud-200 rounded-xl p-4 flex items-start gap-3">
            <div className="text-xl">📍</div>
            <div>
              <div className="font-semibold text-sky-900">{alert.cityName} District · Issued by {alert.issuedBy}</div>
              <div className="text-xs text-ink-500 mt-0.5">{alert.summary}</div>
            </div>
          </div>

          {/* Channel 1: 160-Char DLT SMS */}
          <div className="border border-cloud-200 rounded-xl p-4 bg-white shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sky-900 flex items-center gap-2">
                <span>💬</span> 160-Character DLT-Compliant SMS Payload
              </div>
              <span className="text-xs mono-nums bg-monsoon-100 px-2 py-0.5 rounded text-ink-500">{smsText.length} / 160 chars</span>
            </div>
            <div className="bg-monsoon-100 border border-cloud-200/80 rounded-lg p-3 font-mono text-xs text-ink-800 leading-relaxed">
              {smsText}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleCopy(smsText, 'sms')}
                className="flex-1 py-2 px-3 bg-sky-900 hover:bg-sky-900/90 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                {copiedType === 'sms' ? '✓ Copied to Clipboard!' : '📋 Copy SMS Text'}
              </button>
              <a
                href={`sms:?body=${encodeURIComponent(smsText)}`}
                className="py-2 px-4 bg-sky-500 hover:bg-sky-500/90 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                📱 Open Native SMS App
              </a>
            </div>
            <div className="text-[11px] text-ink-500">Telecom commercial rate: ₹0.15/SMS. Zero data required on recipient feature phone.</div>
          </div>

          {/* Channel 2: Village IVR Loudspeaker Audio */}
          <div className="border border-cloud-200 rounded-xl p-4 bg-white shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sky-900 flex items-center gap-2">
                <span>🔊</span> Village IVR / Panchayat Loudspeaker Script
              </div>
              <span className="text-xs bg-success-green/10 text-success-green px-2 py-0.5 rounded font-semibold">Phonetic Hindi</span>
            </div>
            <div className="bg-monsoon-100 border border-cloud-200/80 rounded-lg p-3 text-xs leading-relaxed text-ink-800">
              "{ivrScript}"
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handlePlayAudio}
                className={`flex-1 py-2 px-3 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${isPlayingAudio ? 'bg-alert-red animate-pulse' : 'bg-success-green hover:bg-success-green/90'}`}
              >
                {isPlayingAudio ? '⏹️ Stop Loudspeaker Audio' : '🔊 Play Audio Broadcast (TTS)'}
              </button>
              <button
                onClick={() => handleCopy(ivrScript, 'ivr')}
                className="py-2 px-4 bg-cloud-200 hover:bg-cloud-200/80 text-ink-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                {copiedType === 'ivr' ? '✓ Copied' : '📋 Copy Script'}
              </button>
            </div>
            <div className="text-[11px] text-ink-500">For Gram Panchayat Sarpanch, ASHA worker, or automated dial-out IVR broadcast.</div>
          </div>

          {/* Channel 3: WhatsApp Community Broadcast */}
          <div className="border border-cloud-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between">
            <div>
              <div className="font-bold text-sky-900 flex items-center gap-1.5">
                <span>📲</span> WhatsApp Village Group Dispatch
              </div>
              <div className="text-xs text-ink-500">Direct dispatch to Farmer Producer Orgs (FPO) & Panchayat groups</div>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              Share on WhatsApp ↗
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-monsoon-100 border-t border-cloud-200 flex items-center justify-between text-xs text-ink-500">
          <div>Transparent SIH Cost Model: ~₹0.15 per SMS per farmer</div>
          <button onClick={() => { stopSpeaking(); onClose(); }} className="py-1.5 px-4 bg-cloud-200 hover:bg-cloud-200/80 rounded-lg text-ink-800 font-semibold">Close Studio</button>
        </div>
      </div>
    </div>
  )
}
