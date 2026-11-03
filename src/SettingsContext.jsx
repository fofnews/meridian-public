import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { DEFAULTS, TEXT_SCALES, loadSettings, saveSettings } from './settings.js';

const SettingsContext = createContext({ ...DEFAULTS, update: () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--text-scale', String(TEXT_SCALES[settings.textSize]));
    root.setAttribute('data-reading-font', settings.readingFont);
    saveSettings(settings);
  }, [settings]);

  const value = useMemo(
    () => ({ ...settings, update: patch => setSettings(s => ({ ...s, ...patch })) }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
