// Read checkmarks. localStorage key 'meridian-read':
//   { "<date>-<edition>": ["group-0", "story-12", ...], ... }
// Object order is recency of use; only the last MAX_EDITIONS editions are kept.

const KEY = 'meridian-read';
const MAX_EDITIONS = 14;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable or full: read marks just don't persist
  }
}

export function getReadIds(editionKey) {
  const ids = load()[editionKey];
  return new Set(Array.isArray(ids) ? ids : []);
}

export function markRead(editionKey, itemId) {
  const data = load();
  const ids = Array.isArray(data[editionKey]) ? data[editionKey] : [];
  delete data[editionKey];
  data[editionKey] = ids.includes(itemId) ? ids : [...ids, itemId];
  const keys = Object.keys(data);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_EDITIONS))) delete data[k];
  save(data);
}
