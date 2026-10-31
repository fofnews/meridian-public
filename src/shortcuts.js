const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function shouldIgnoreKey(e, settingsOpen) {
  if (settingsOpen) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target;
  if (t && (TYPING_TAGS.has(t.tagName) || t.isContentEditable)) return true;
  return false;
}

export function nextRowIndex(current, count, direction) {
  if (count === 0) return -1;
  if (current < 0) return direction > 0 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + direction));
}
