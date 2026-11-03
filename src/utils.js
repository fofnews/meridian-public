const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;

export function decodeText(str) {
  if (!str || !textarea) return str ?? '';
  textarea.innerHTML = str.trim();
  return textarea.value;
}

export function formatAnalysisTime(fetchedAt) {
  if (!fetchedAt) return '';
  const d = new Date(fetchedAt);
  if (Number.isNaN(d.getTime())) return '';
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
  return `${t} ET`;
}
