// Reader settings. Everything lives in this browser's localStorage:
//   meridian-theme        'system' | 'dark' | 'light'         (ThemeContext)
//   meridian-settings     JSON { textSize, readingFont, startTab, markOpened }
//   meridian-map-visible  'true' | 'false'                    (App)
//   meridian-map          'true' | 'false'                    (MapHero, legacy)
//   meridian-read         read marks                          (readState.js)

export const SETTINGS_KEY = 'meridian-settings';
export const THEME_KEY = 'meridian-theme';
export const MAP_VISIBLE_KEY = 'meridian-map-visible';
const OWNED_KEYS = [SETTINGS_KEY, THEME_KEY, MAP_VISIBLE_KEY, 'meridian-map', 'meridian-read'];

export const TEXT_SCALES = { small: 0.9, normal: 1, large: 1.15, larger: 1.3 };
export const READING_FONTS = ['source-serif', 'atkinson'];
export const START_TABS = ['facts', 'disagreements'];

export const DEFAULTS = {
  textSize: 'normal',
  readingFont: 'source-serif',
  startTab: 'facts',
  markOpened: true,
};

export function loadSettings() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch {
    raw = null;
  }
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    textSize: Object.hasOwn(TEXT_SCALES, v.textSize) ? v.textSize : DEFAULTS.textSize,
    readingFont: READING_FONTS.includes(v.readingFont) ? v.readingFont : DEFAULTS.readingFont,
    startTab: START_TABS.includes(v.startTab) ? v.startTab : DEFAULTS.startTab,
    markOpened: typeof v.markOpened === 'boolean' ? v.markOpened : DEFAULTS.markOpened,
  };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable or full: settings apply for this visit only
  }
}

export function loadMapVisible() {
  try {
    return localStorage.getItem(MAP_VISIBLE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveMapVisible(visible) {
  try {
    localStorage.setItem(MAP_VISIBLE_KEY, String(visible));
  } catch {
    // see saveSettings
  }
}

export function clearAllStored() {
  for (const k of OWNED_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      // see saveSettings
    }
  }
}
