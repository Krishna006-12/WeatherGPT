import React from 'react'

export default function SihMatrixModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-4 animate-slideUp">
      <div className="bg-white border border-cloud-200 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 bg-sky-900 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xs uppercase tracking-widest font-mono opacity-80">Smart India Hackathon 2026</div>
              <h2 className="text-lg font-bold">SIH Round 2 Technical Evaluation Matrix</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold">✕</button>
        </div>

        {/* Matrix Content */}
        <div className="p-6 space-y-6 text-sm text-ink-800">
          {/* Section 1: Core Innovations */}
          <div>
            <h3 className="font-bold text-sky-900 text-base mb-3 border-b border-cloud-200 pb-1">1. Key SIH Capabilities & Live Status</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-cloud-200 rounded-lg overflow-hidden">
                <thead className="bg-sky-900 text-white">
                  <tr>
                    <th className="p-2.5">Feature</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Technical Implementation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cloud-200">
                  <tr className="bg-white">
                    <td className="p-2.5 font-semibold">Real-Time Met Ingestion</td>
                    <td className="p-2.5 text-success-green font-bold">✓ LIVE (100%)</td>
                    <td className="p-2.5 text-ink-500">Open-Meteo live API + 40+ Indian Cities + Geocoding Search</td>
                  </tr>
                  <tr className="bg-monsoon-100">
                    <td className="p-2.5 font-semibold">Grounded AI Copilot & Voice</td>
                    <td className="p-2.5 text-success-green font-bold">✓ LIVE (100%)</td>
                    <td className="p-2.5 text-ink-500">Retrieve-then-phrase RAG engine + Web Speech STT & TTS</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-2.5 font-semibold">Multi-Model NWP Ensemble</td>
                    <td className="p-2.5 text-success-green font-bold">✓ LIVE (100%)</td>
                    <td className="p-2.5 text-ink-500">NOAA GFS vs ECMWF IFS vs DWD ICON spread & variance score</td>
                  </tr>
                  <tr className="bg-monsoon-100">
                    <td className="p-2.5 font-semibold">Agro-Meteorological Advisory</td>
                    <td className="p-2.5 text-success-green font-bold">✓ LIVE (100%)</td>
                    <td className="p-2.5 text-ink-500">ICAR/IMD Gramin Krishi Mausam logic (Irrigation & Spray windows)</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-2.5 font-semibold">Rural Relay (No-Internet reach)</td>
                    <td className="p-2.5 text-success-green font-bold">✓ LIVE (100%)</td>
                    <td className="p-2.5 text-ink-500">160-Char DLT SMS + Village IVR Loudspeaker Voice + WhatsApp</td>
                  </tr>
                  <tr className="bg-monsoon-100">
                    <td className="p-2.5 font-semibold">Multilingual Indic Support</td>
                    <td className="p-2.5 text-success-green font-bold">✓ LIVE (6 Langs)</td>
                    <td className="p-2.5 text-ink-500">English, हिन्दी, मराठी, বাংলা, తెలుగు, ਪੰਜਾਬੀ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Architecture & Anti-Hallucination */}
          <div>
            <h3 className="font-bold text-sky-900 text-base mb-3 border-b border-cloud-200 pb-1">2. Grounded Architecture & Honesty Sheet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-monsoon-100 border border-cloud-200 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-sky-900 flex items-center gap-2">
                  <span>🛡️</span> Grounded RAG Pipeline
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">
                  User Query → Multilingual Intent Router → Meteorological JSON Pack Fetch → Agro Decision Tree Calculation → Strictly Constrained Response Formatter.
                </p>
                <div className="text-xs font-semibold text-success-green">✓ Zero Hallucination Guarantee</div>
              </div>
              <div className="bg-monsoon-100 border border-cloud-200 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-sky-900 flex items-center gap-2">
                  <span>💰</span> Cost & Scale Viability Model
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">
                  • Cloud Infrastructure: Serverless Edge (₹0 free tier).<br/>
                  • SMS DLT Gateway: ₹0.15 per SMS per event.<br/>
                  • 50,000 farmers in a district with 4 Red Alerts/year = <b>₹30,000/year</b> (Supported via State DDMA/Agri Budget).
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Live API Endpoints */}
          <div>
            <h3 className="font-bold text-sky-900 text-base mb-3 border-b border-cloud-200 pb-1">3. Live APIs & Endpoints</h3>
            <div className="space-y-1.5 font-mono text-xs text-ink-800">
              <div className="bg-monsoon-100 p-2 rounded border border-cloud-200/80"><code>GET /api/public?action=chat&amp;q=rain%20today&amp;name=Kanpur</code></div>
              <div className="bg-monsoon-100 p-2 rounded border border-cloud-200/80"><code>GET /api/weather?lat=26.84&amp;lon=80.94&amp;name=Lucknow</code></div>
              <div className="bg-monsoon-100 p-2 rounded border border-cloud-200/80"><code>GET /api/models?lat=19.07&amp;lon=72.87&amp;name=Mumbai</code></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-monsoon-100 border-t border-cloud-200 flex justify-end">
          <button onClick={onClose} className="py-2 px-5 bg-sky-900 hover:bg-sky-900/90 text-white rounded-lg font-semibold text-xs transition">Back to Application</button>
        </div>
      </div>
    </div>
  )
}
