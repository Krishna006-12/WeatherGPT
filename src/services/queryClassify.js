/**
 * Query classifier — runs BEFORE location/weather pipeline.
 *
 * Output shape:
 * {
 *   type: 'crop' | 'crop_location' | 'location_weather' | 'weather' | 'agriculture' | 'general' | 'followup_crop',
 *   crop: { id, name_en, ... } | null,
 *   locationQuery: string | null,  // phrase to resolve as place (never a crop token)
 *   allowGeocode: boolean,         // if false, location pipeline must not run on raw query
 *   allowWeatherAsPlace: boolean,  // if false, never use raw query as weather place name
 * }
 */

import {
  detectCrop,
  isCropToken,
  isCropQuestion,
  isCropFollowUp,
  getCropById,
} from '../data/crops.js'

const PLACE_PREP =
  /\b(?:in|at|near|around|of|for|from)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,48})/i

const WEATHER_PLACE =
  /\b(?:weather|forecast|rain|temperature|temp|climate|aqi|mausam|baarish|humidity|wind)\s+(?:in|at|of|for|near|around)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,48})/i

const PLACE_WEATHER =
  /\b([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{2,40})\s+(?:weather|forecast|rain|mausam|baarish|temperature|temp)\b/i

function cleanLoc(raw) {
  if (!raw) return null
  let p = String(raw)
    .trim()
    .replace(/[?.!,;:]+$/g, '')
    .replace(
      /\b(right\s+now|today|tonight|tomorrow|please|pls|now|weather|forecast|rain|temp|temperature)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
  // strip crop tokens from location phrase
  p = p
    .split(/\s+/)
    .filter((t) => t && !isCropToken(t) && !detectCrop(t))
    .join(' ')
    .trim()
  if (!p || p.length < 2) return null
  if (isCropToken(p) || detectCrop(p)) return null
  return p
}

/**
 * Classify raw user chat text. Pure — no network.
 * @param {string} text
 * @param {{ cropId?: string } | null} cropContext prior turn crop
 */
export function classifyQuery(text, cropContext = null) {
  const raw = String(text || '').trim()
  if (!raw) {
    return {
      type: 'general',
      crop: null,
      locationQuery: null,
      allowGeocode: false,
      allowWeatherAsPlace: false,
    }
  }

  const crop = detectCrop(raw)
  const followUp =
    !crop && cropContext?.cropId && isCropFollowUp(raw)
      ? getCropById(cropContext.cropId)
      : null
  const activeCrop = crop || followUp

  // Follow-up with session crop context wins over generic "rain" classification
  if (followUp) {
    return {
      type: 'followup_crop',
      crop: followUp,
      locationQuery: null,
      allowGeocode: false,
      allowWeatherAsPlace: false,
    }
  }

  // --- Explicit weather-of-place (no crop) ---
  const wxPlace = raw.match(WEATHER_PLACE)?.[1] || raw.match(PLACE_WEATHER)?.[1]
  const wxLoc = cleanLoc(wxPlace)
  if (wxLoc && !crop) {
    return {
      type: 'location_weather',
      crop: null,
      locationQuery: wxLoc,
      allowGeocode: true,
      allowWeatherAsPlace: true,
    }
  }

  // --- Crop (+ optional location) ---
  // Crop route if named crop OR follow-up — never treat crop token as city
  if (activeCrop && (crop || followUp || isCropQuestion(raw))) {
    // location only from preposition / explicit place — never the crop token
    let loc = cleanLoc(raw.match(PLACE_PREP)?.[1]) || null

    // "wheat in Kanpur" — PLACE_PREP captures Kanpur
    // If weather+place also present with crop ("weather for wheat in Kanpur")
    if (!loc && wxLoc && !isCropToken(wxLoc) && !detectCrop(wxLoc)) {
      loc = wxLoc
    }

    // "Kanpur wheat" / "wheat Kanpur" — other token(s) as place candidate
    if (!loc) {
      const tokens = raw
        .replace(/[?.!,;:]+$/g, '')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
      const placeish = tokens.filter((t) => {
        const tl = t.toLowerCase()
        if (isCropToken(tl) || detectCrop(tl)) return false
        if (
          /^(in|at|for|of|the|a|an|my|our|about|will|rain|weather|irrigat\w*|spray\w*|how|what|should|kya|hai|ki|ke|ka|se|par)$/i.test(
            tl,
          )
        )
          return false
        // likely place: capitalised Latin or Devanagari word length >= 3
        if (/^[\u0900-\u097F]{3,}$/.test(t)) return true
        if (/^[A-Za-z][A-Za-z.'-]{2,}$/.test(t) && t[0] === t[0].toUpperCase()) return true
        // lowercase multi-letter known pattern — still allow single trailing/leading non-crop
        if (/^[A-Za-z]{4,}$/.test(t) && tokens.length <= 4) return true
        return false
      })
      if (placeish.length === 1) {
        loc = cleanLoc(placeish[0])
      }
    }

    // Reject loc if it's the crop itself or agri jargon
    if (
      loc &&
      (isCropToken(loc) ||
        detectCrop(loc)?.id === activeCrop.id ||
        /\b(irrigat|spray|harvest|sowing|blight|disease|fungal|weather|rain|baarish)\b/i.test(loc))
    ) {
      loc = null
    }

    return {
      type: loc ? 'crop_location' : followUp ? 'followup_crop' : 'crop',
      crop: activeCrop,
      locationQuery: loc,
      // ONLY geocode the extracted location phrase — never raw query / crop name
      allowGeocode: !!loc,
      allowWeatherAsPlace: false,
    }
  }

  // Bare crop token even if isCropQuestion edge-fails
  if (crop && isCropToken(raw.replace(/[?.!,;:]+$/g, '').trim())) {
    return {
      type: 'crop',
      crop,
      locationQuery: null,
      allowGeocode: false,
      allowWeatherAsPlace: false,
    }
  }

  // Agriculture without named crop
  if (
    /\b(irrigat|sinchai|सिंचाई|farm|कृषि|spray|छिड़काव|sowing|harvest|कटाई)\b/i.test(
      raw
    )
  ) {
    return {
      type: 'agriculture',
      crop: crop || null,
      locationQuery: wxLoc || cleanLoc(raw.match(PLACE_PREP)?.[1]) || null,
      allowGeocode: true,
      allowWeatherAsPlace: true,
    }
  }

  // Generic location mention
  const prepLoc = cleanLoc(raw.match(PLACE_PREP)?.[1])
  if (prepLoc) {
    return {
      type: 'location_weather',
      crop: null,
      locationQuery: prepLoc,
      allowGeocode: true,
      allowWeatherAsPlace: true,
    }
  }

  // Bare place-like query (single token that is NOT a crop) — allow existing pipeline
  const bare = raw.toLowerCase().replace(/[?.!,;:]+$/g, '').trim()
  if (isCropToken(bare) || detectCrop(bare)) {
    return {
      type: 'crop',
      crop: detectCrop(bare),
      locationQuery: null,
      allowGeocode: false,
      allowWeatherAsPlace: false,
    }
  }

  return {
    type: 'weather',
    crop: null,
    locationQuery: null, // let existing extractCity handle famous places etc.
    allowGeocode: true,
    allowWeatherAsPlace: true,
  }
}

/** True if classifier says this must never hit geocode/weather as a place name */
export function isCropOnlyClassification(c) {
  return c && (c.type === 'crop' || c.type === 'followup_crop') && !c.locationQuery
}

export function isCropRoute(c) {
  return c && (c.type === 'crop' || c.type === 'crop_location' || c.type === 'followup_crop')
}
