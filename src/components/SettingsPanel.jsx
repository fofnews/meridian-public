import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../ThemeContext.jsx';
import { useSettings } from '../SettingsContext.jsx';
import { DEFAULTS, clearAllStored } from '../settings.js';

const LABEL = { fontFamily: 'var(--font-label)' };
const TABS = [
  { id: 'display', label: 'Display' },
  { id: 'stories', label: 'Stories' },
  { id: 'map', label: 'Map' },
  { id: 'about', label: 'About' },
];
const SHORTCUTS = [
  ['j / k', 'Next / previous story'],
  ['Enter', 'Open or close the focused story'],
  ['1 – 4', 'Switch tabs in the open story'],
  ['?', 'Open these settings'],
  ['Esc', 'Close settings'],
];
const FOCUSABLE = 'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])';

function Group({ label, hint, children }) {
  return (
    <div style={{ padding: '18px 0', borderBottom: '1px solid var(--border-dim)' }}>
      <div className="font-semibold" style={{ ...LABEL, fontSize: 14, color: 'var(--text-primary)' }}>{label}</div>
      {hint && <p style={{ ...LABEL, fontSize: 13, lineHeight: 1.5, color: 'var(--label)', marginTop: 4 }}>{hint}</p>}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap" style={{ gap: 8 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="cursor-pointer"
            style={{
              ...LABEL, fontSize: 14, fontWeight: on ? 600 : 500, minHeight: 44, padding: '0 16px', borderRadius: 4,
              color: on ? 'var(--gold-text)' : 'var(--text-secondary)',
              background: 'transparent',
              border: `1px solid ${on ? 'var(--gold-text)' : 'var(--border-primary)'}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="cursor-pointer flex items-center justify-between w-full"
      style={{ ...LABEL, minHeight: 44, background: 'none', border: 'none', padding: 0, color: 'var(--text-primary)', fontSize: 14, textAlign: 'left' }}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: 40, height: 22, borderRadius: 11, flexShrink: 0, marginLeft: 12,
          background: checked ? 'var(--gold-text)' : 'transparent',
          border: `1px solid ${checked ? 'var(--gold-text)' : 'var(--border-primary)'}`,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 16, height: 16, borderRadius: '50%',
          background: checked ? 'var(--bg-primary)' : 'var(--label)', transition: 'left 0.15s ease',
        }} />
      </span>
    </button>
  );
}

function ActionButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer"
      style={{ ...LABEL, fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 16px', borderRadius: 4, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
    >
      {children}
    </button>
  );
}

export default function SettingsPanel({
  open, tab, onTabChange, onClose, mapVisible, onMapVisibleChange, onMarkAllRead, onClearRead,
}) {
  const { preference, setPreference } = useTheme();
  const settings = useSettings();
  const panelRef = useRef(null);
  const tabRefs = useRef({});
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    const body = document.body;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    panelRef.current?.querySelector('[data-autofocus]')?.focus();

    // Capture phase on window and stopPropagation, so the fullscreen map's
    // own Escape listener never sees the key while settings is open.
    const onKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panelRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      setNote('');
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTabKey = e => {
    const i = TABS.findIndex(t => t.id === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length];
    if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length];
    if (next) {
      e.preventDefault();
      onTabChange(next.id);
      tabRefs.current[next.id]?.focus();
    }
  };

  const resetAll = () => {
    clearAllStored();
    setPreference('system');
    settings.update(DEFAULTS);
    onMapVisibleChange(true);
    onClearRead();
    setNote('Settings and read history cleared.');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '100vw',
          background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.28)',
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: '8px 8px 0 24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</h2>
          <button
            data-autofocus
            onClick={onClose}
            aria-label="Close settings"
            className="cursor-pointer flex items-center justify-center"
            style={{ width: 44, height: 44, background: 'none', border: 'none', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div role="tablist" aria-label="Settings sections" onKeyDown={onTabKey} className="flex" style={{ padding: '0 24px', borderBottom: '1px solid var(--border-primary)', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              ref={el => { tabRefs.current[t.id] = el; }}
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="settings-tabpanel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => onTabChange(t.id)}
              className="cursor-pointer"
              style={{
                ...LABEL, fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 12px', background: 'none', border: 'none',
                color: tab === t.id ? 'var(--gold-text)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--gold-text)' : 'transparent'}`, marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {tab === 'display' && (
            <>
              <Group label="Theme">
                <Segmented
                  label="Theme"
                  value={preference}
                  onChange={setPreference}
                  options={[{ value: 'system', label: 'System' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
                />
              </Group>
              <Group label="Text size" hint="Scales the story analysis. The map stays as it is.">
                <Segmented
                  label="Text size"
                  value={settings.textSize}
                  onChange={v => settings.update({ textSize: v })}
                  options={[{ value: 'small', label: 'Small' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }, { value: 'larger', label: 'Larger' }]}
                />
              </Group>
              <Group label="Reading font">
                <Segmented
                  label="Reading font"
                  value={settings.readingFont}
                  onChange={v => settings.update({ readingFont: v })}
                  options={[{ value: 'source-serif', label: 'Source Serif' }, { value: 'atkinson', label: 'Atkinson Hyperlegible' }]}
                />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 12 }}>
                  The same facts, reported by several outlets, read side by side.
                </p>
              </Group>
            </>
          )}

          {tab === 'stories' && (
            <>
              <Group label="An opened story starts on">
                <Segmented
                  label="An opened story starts on"
                  value={settings.startTab}
                  onChange={v => settings.update({ startTab: v })}
                  options={[{ value: 'facts', label: 'Facts' }, { value: 'disagreements', label: 'Disagreements' }]}
                />
              </Group>
              <Group label="Read marks" hint="A check appears on stories you've opened, so you can see what's left.">
                <Switch label="Mark stories I've opened" checked={settings.markOpened} onChange={v => settings.update({ markOpened: v })} />
                <div className="flex flex-wrap" style={{ gap: 8, marginTop: 8 }}>
                  <ActionButton onClick={() => { onMarkAllRead(); setNote('Marked every story in this edition as read.'); }}>Mark all as read</ActionButton>
                  <ActionButton onClick={() => { onClearRead(); setNote('Read history cleared.'); }}>Clear read history</ActionButton>
                </div>
                <p role="status" style={{ ...LABEL, fontSize: 13, color: 'var(--gold-text)', marginTop: 8, minHeight: 18 }}>{note}</p>
              </Group>
              <Group label="Keyboard shortcuts">
                <dl style={{ ...LABEL, fontSize: 14 }}>
                  {SHORTCUTS.map(([keys, what]) => (
                    <div key={keys} className="flex items-baseline" style={{ gap: 12, padding: '4px 0' }}>
                      <dt style={{ width: 72, flexShrink: 0 }}>
                        <kbd style={{ ...LABEL, fontSize: 12, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>{keys}</kbd>
                      </dt>
                      <dd style={{ color: 'var(--text-secondary)' }}>{what}</dd>
                    </div>
                  ))}
                </dl>
              </Group>
            </>
          )}

          {tab === 'map' && (
            <Group
              label="Map"
              hint="When off, the map is hidden now and isn't loaded on your next visit. Each opened story still names its locations."
            >
              <Switch label="Show the map" checked={mapVisible} onChange={onMapVisibleChange} />
            </Group>
          )}

          {tab === 'about' && (
            <Group label="Your data">
              <p style={{ ...LABEL, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Stored in this browser: your settings and the stories you've opened. Nothing is sent to The Meridian, and nothing needs an account.
              </p>
              <div style={{ marginTop: 12 }}>
                <ActionButton onClick={resetAll}>Clear settings and read history</ActionButton>
              </div>
              <p role="status" style={{ ...LABEL, fontSize: 13, color: 'var(--gold-text)', marginTop: 8, minHeight: 18 }}>{note}</p>
            </Group>
          )}
        </div>
      </div>
    </div>
  );
}
