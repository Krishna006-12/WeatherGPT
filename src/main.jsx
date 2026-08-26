import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DevicePreview, { isEmbedMode, shouldUseDevicePreview } from './components/DevicePreview.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Analytics } from '@vercel/analytics/react'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:24px">WeatherGPT: #root missing</p>'
} else {
  // Default: clean App (phone + laptop) — no M/T/D/F bar
  // Lab frames only: ?preview=1
  // Iframe inside lab: embed=1 → plain App
  const Root = isEmbedMode() || !shouldUseDevicePreview() ? App : DevicePreview

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <Root />
        <Analytics />
      </ErrorBoundary>
    </StrictMode>
  )
}
