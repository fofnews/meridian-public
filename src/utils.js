const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;

export function decodeText(str) {
  if (!str || !textarea) return str ?? '';
  textarea.innerHTML = str.trim();
  return textarea.value;
}
