import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchLiveAlertsFeed,
  getPermission,
  notificationSupported,
  notifyNewAlerts,
  requestNotificationPermission,
  seedSeenFromAlerts,
  showAlertNotification,
  loadWatchList,
} from '../services/notifications'

const POLL_MS = 3 * 60 * 1000 // 3 min — proper-app cadence without hammering free APIs
const MIN_SEVERITY_DEFAULT = 'yellow'

/**
 * Background live-alert poller + OS notifications for watched cities.
 */
export function useAlertMonitor({
  enabled = true,
  lang = 'en',
  homeCityId = 'kanpur',
  focusCity = null,
  minSeverity = MIN_SEVERITY_DEFAULT,
  onAlerts,
}) {
  const [permission, setPermission] = useState(() => getPermission())
  const [feed, setFeed] = useState({ alerts: [], points: [], live: false, fetchedAt: null })
  const [polling, setPolling] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [lastNotify, setLastNotify] = useState(null)
  const seeded = useRef(false)
  const onAlertsRef = useRef(onAlerts)
  onAlertsRef.current = onAlerts

  const refresh = useCallback(async () => {
    if (!enabled) return null
    setPolling(true)
    setLastError(null)
    const ctrl = new AbortController()
    try {
      const data = await fetchLiveAlertsFeed({
        homeCityId,
        focusCity,
        radiusKm: 600,
        signal: ctrl.signal,
      })
      if (!data.ok && data.error) setLastError(data.error)
      setFeed({
        alerts: data.alerts || [],
        points: data.points || [],
        live: !!data.live,
        fetchedAt: data.fetchedAt || Date.now(),
        sources: data.sources,
        fallback: data.fallback,
      })
      onAlertsRef.current?.(data.alerts || [])

      // First successful fetch: mark current as seen (no spam on enable)
      if (!seeded.current && (data.alerts || []).length) {
        seedSeenFromAlerts(data.alerts)
        seeded.current = true
      } else if (permission === 'granted' && enabled) {
        const r = await notifyNewAlerts(data.alerts || [], {
          lang,
          minSeverity,
          maxPerTick: 3,
        })
        if (r.sent > 0) {
          setLastNotify({ at: Date.now(), sent: r.sent })
        }
      }
      return data
    } catch (e) {
      setLastError(e.message || 'poll failed')
      return null
    } finally {
      setPolling(false)
    }
  }, [enabled, homeCityId, focusCity, lang, minSeverity, permission])

  // Poll loop
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      // Skip heavy poll when tab hidden — still run occasionally via visibility handler
      if (document.visibilityState === 'hidden') return
      await refresh()
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, refresh])

  const enablePush = useCallback(async () => {
    const p = await requestNotificationPermission()
    setPermission(p)
    if (p === 'granted') {
      // Re-seed so we don't dump backlog
      if (feed.alerts?.length) seedSeenFromAlerts(feed.alerts)
      seeded.current = true
      // Immediate refresh then notify only NEW after this moment
      await refresh()
    }
    return p
  }, [feed.alerts, refresh])

  const testNotification = useCallback(async () => {
    let p = getPermission()
    if (p !== 'granted') p = await requestNotificationPermission()
    setPermission(p)
    if (p !== 'granted') return { ok: false, reason: p }
    const demo = {
      id: `test-${Date.now()}`,
      notifyKey: `test-${Date.now()}`,
      severity: 'amber',
      title: lang === 'hi' ? 'टेस्ट अलर्ट' : 'Test alert',
      title_hi: 'टेस्ट अलर्ट',
      summary:
        lang === 'hi'
          ? 'WeatherGPT नोटिफिकेशन काम कर रहा है।'
          : 'WeatherGPT notifications are working.',
      summary_hi: 'WeatherGPT नोटिफिकेशन काम कर रहा है।',
      place: focusCity?.name || 'WeatherGPT',
    }
    return showAlertNotification(demo, { lang })
  }, [lang, focusCity])

  /** Call when weather pack / simulate injects a new alert */
  const notifyFromWeatherAlerts = useCallback(
    async (alerts, { force = false } = {}) => {
      if (!enabled || getPermission() !== 'granted') return { sent: 0 }
      const cityName =
        focusCity?.name || (typeof focusCity === 'object' ? focusCity?.name : '') || ''
      const enriched = (alerts || []).map((a) => ({
        ...a,
        place: a.place || cityName,
        notifyKey: a.notifyKey || `${a.id}::${a.place || cityName || 'local'}`,
      }))
      if (force) {
        // allow re-notify by not filtering seen for forced single
        let sent = 0
        for (const a of enriched.slice(0, 2)) {
          // temporarily clear seen for this key if force
          const r = await showAlertNotification(
            { ...a, notifyKey: force ? `${a.notifyKey}-f${Date.now()}` : a.notifyKey },
            { lang }
          )
          if (r.ok) sent++
        }
        return { sent }
      }
      return notifyNewAlerts(enriched, { lang, minSeverity, maxPerTick: 2 })
    },
    [enabled, focusCity, lang, minSeverity]
  )

  return {
    supported: notificationSupported(),
    permission,
    feed,
    polling,
    lastError,
    lastNotify,
    watchList: loadWatchList(homeCityId),
    refresh,
    enablePush,
    testNotification,
    notifyFromWeatherAlerts,
    setPermission,
  }
}
