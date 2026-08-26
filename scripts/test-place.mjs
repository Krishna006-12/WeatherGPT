import { resolveMentionedCity } from '../src/services/ai.js'

const tests = [
  'what is the weather of tokyo',
  'weather in Tokyo',
  'Tokyo weather',
  'travel risk in Noida',
  'how is weather in Dubai',
  'rain in London',
  'Japan weather',
  'weather of paris',
]

for (const t of tests) {
  try {
    const r = await resolveMentionedCity(t, null)
    console.log(
      JSON.stringify({
        q: t,
        name: r?.name,
        id: r?.id,
        lat: r?.lat,
        lon: r?.lon,
        cc: r?.countryCode,
      })
    )
  } catch (e) {
    console.log(JSON.stringify({ q: t, err: e.message }))
  }
}
