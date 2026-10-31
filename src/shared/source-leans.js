// Shared outlet lean data for the site, Remotion, and build-shotlist.js.
//
// LEGACY_LEANS: the map as it was before the Oct 30, 2026 AllSides check.
// Frozen — never edit. Used for any report that predates sourceLeans stamping.
//
// CURRENT_LEANS: the map after the Oct 30, 2026 AllSides check.
// Used by Remotion and build-shotlist.js for new editions, and as a fallback
// when a report unexpectedly lacks a sourceLeans field.
//
// leansFor(report): returns report.sourceLeans when present (stamped by the
// pipeline at analysis time), otherwise falls back to LEGACY_LEANS so past
// editions keep the leans they were published with.
//
// localStorage keys (Phase 7): meridian-read-v1, meridian-settings-v1

export const LEGACY_LEANS = Object.freeze({
  // Left
  'CNN':                 'left',
  'NPR':                 'left',
  'ABC News':            'left',
  'CBS News':            'left',
  'NY Times':            'left',
  'NBC News':            'left',
  'Washington Post':     'left',
  'Newsweek':            'left',
  'Politico':            'left',
  // Center
  'BBC News':            'center',
  'Al Jazeera':          'center',
  'Reuters':             'center',
  'AP News':             'center',
  'The Hill':            'center',
  'The Free Press':      'center',
  // Right
  'Wall Street Journal': 'right',
  'Fox News':            'right',
  'New York Post':       'right',
  'Washington Examiner': 'right',
  'National Review':     'right',
  'Newsmax':             'right',
  'Epoch Times':         'right',
});

// Five changes from AllSides check on 2026-10-30.
// CBS News and NY Times: AllSides pages unreadable on that date; kept as left.
export const CURRENT_LEANS = Object.freeze({
  // Left
  'CNN':                 'left',
  'NPR':                 'left',
  'ABC News':            'left',
  'CBS News':            'left',
  'NY Times':            'left',
  'NBC News':            'left',
  'Washington Post':     'left',
  'Al Jazeera':          'left',   // was center
  'AP News':             'left',   // was center
  'Politico':            'left',
  // Center
  'BBC News':            'center',
  'Reuters':             'center',
  'The Hill':            'center',
  'Newsweek':            'center', // was left
  'Wall Street Journal': 'center', // was right
  // Right
  'Fox News':            'right',
  'New York Post':       'right',
  'Washington Examiner': 'right',
  'National Review':     'right',
  'Newsmax':             'right',
  'Epoch Times':         'right',
  'The Free Press':      'right',  // was center
});

/** Groups the outlets in a lean map by lean, keeping the map's key order (feed order). */
export function outletsByLean(leans) {
  const groups = { left: [], center: [], right: [] };
  for (const [outlet, lean] of Object.entries(leans ?? {})) {
    if (groups[lean]) groups[lean].push(outlet);
  }
  return groups;
}

/** Total number of outlets in a lean map. */
export function outletCount(leans) {
  return Object.keys(leans ?? {}).length;
}

/** Returns the lean map that was in effect when this report was published. */
export function leansFor(report) {
  return report?.sourceLeans ?? LEGACY_LEANS;
}

/** Returns the lean for one outlet from a given map, or null if unknown. */
export function leanOf(leans, source) {
  return leans?.[source] ?? null;
}
