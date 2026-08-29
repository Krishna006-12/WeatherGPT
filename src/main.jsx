import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ui-redesign.css'
import './ui-premium-motion.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:24px">WeatherGPT: #root missing</p>'
} else {
  // Lab device frames only when ?preview=1 — keep default path thin
  const wantPreview =
    typeof location !== 'undefined' &&
    /(?:\?|&)preview=1(?:&|$)/.test(location.search || '') &&
    !/(?:\?|&)embed=1(?:&|$)/.test(location.search || '')

  const mount = (Root) => {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
      </StrictMode>,
    )
  }

  if (wantPreview) {
    import('./components/DevicePreview.jsx')
      .then(({ default: DevicePreview }) => mount(DevicePreview))
      .catch(() => mount(App))
  } else {
    mount(App)
  }
}
