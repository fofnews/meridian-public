// Headline-driven location lookup. Used as a fallback when a story's
// analysis.locations is empty. Item #13 will remove this from broadcast
// rendering (a wrong geocode reads as a factual error on video) but
// the website still uses it for stories without structured locations.

import { getStoryZoom } from './camera.js';

const geocodeCache = {};

const SKIP_WORDS = new Set([
  'The','His','Her','Its','Their','This','That','These','Those','After','Before',
  'During','Former','New','Possible','National','Federal','State','Supreme','Top',
  'First','Last','Multiple','Several','Key','Major','High','Low','Big','Old',
  'North','South','East','West','Central','United','House','Senate','White','Black',
]);

export function extractLocationQuery(headline) {
  const words = headline.split(/[\s,;:()\-–—]+/).filter(Boolean);
  const places = words.filter(w =>
    /^[A-Z][a-z]{2,}/.test(w) &&
    !SKIP_WORDS.has(w) &&
    !/^(FBI|CIA|TSA|DHS|NATO|GOP|UN|EU)$/.test(w)
  ).map(w => w.replace(/[''s]+$/, '')); // strip possessives
  return places.slice(0, 2).join(' ') || null;
}

export async function fetchBoundaryPolygon(name, iso) {
  if (!name) return null;
  const cacheKey = `poly:${name}:${iso ?? ''}`;
  if (geocodeCache[cacheKey] !== undefined) return geocodeCache[cacheKey];

  try {
    const q = iso ? `${name}, ${iso}` : name;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&polygon_geojson=1&polygon_threshold=0.005`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheMeridian/1.0' } });
    const data = await res.json();
    if (data.length) {
      const geojson = data[0].geojson;
      if (geojson && (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon')) {
        const polygon = { type: 'Feature', geometry: geojson, properties: {} };
        geocodeCache[cacheKey] = polygon;
        return polygon;
      }
    }
  } catch (e) {
    console.warn('Boundary fetch failed:', e);
  }
  geocodeCache[cacheKey] = null;
  return null;
}

export async function geocodeStory(story) {
  if (geocodeCache[story.id] !== undefined) return geocodeCache[story.id];

  const fallback = { lng: 0, lat: 20, zoom: 1.0, polygon: null };
  const locationQuery = extractLocationQuery(story.headline);
  if (!locationQuery) {
    geocodeCache[story.id] = fallback;
    return fallback;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1&polygon_geojson=1&polygon_threshold=0.005`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TheMeridian/1.0' } });
    const data = await res.json();
    if (data.length) {
      const geojson = data[0].geojson;
      const polygon = (geojson && (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon'))
        ? { type: 'Feature', geometry: geojson, properties: {} }
        : null;
      const result = { lng: parseFloat(data[0].lon), lat: parseFloat(data[0].lat), zoom: getStoryZoom(), polygon };
      geocodeCache[story.id] = result;
      return result;
    }
  } catch (e) {
    console.warn('Geocoding failed:', e);
  }

  geocodeCache[story.id] = fallback;
  return fallback;
}
