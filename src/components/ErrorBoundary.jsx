import { Component } from 'react'

/**
 * Catches render crashes so users never see a fully blank page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('WeatherGPT crash:', error, info)
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#06101f',
            color: '#e2e8f0',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: '100%',
              background: '#0b1f3a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, opacity: 0.6, letterSpacing: '0.08em' }}>
              WEATHERGPT
            </p>
            <h2 style={{ margin: '8px 0 12px', fontSize: 18 }}>Something went wrong</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
              {msg}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                border: 'none',
                background: '#5b9fd4',
                color: '#06101f',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
