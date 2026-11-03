import { createContext, useContext, useState, useEffect } from 'react';
import { THEME_KEY } from './settings.js';

const ThemeContext = createContext({ isDark: true, preference: 'system', setPreference: () => {} });

const QUERY = '(prefers-color-scheme: dark)';

function readPreference() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemIsDark() {
  return typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : true;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(systemIsDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = e => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = preference === 'system' ? systemDark : preference === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch {
      // storage unavailable: the choice applies for this visit only
    }
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ isDark, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
