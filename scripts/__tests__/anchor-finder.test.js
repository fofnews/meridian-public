import { describe, it, expect } from 'vitest';
import {
  ANCHOR_DEFAULTS,
  findAnchors,
  filterAnchors,
  buildAnchoredCameraPath,
  findQuoteOverlays,
} from '../anchor-finder.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTimestamps(text, charSecondsMap = {}) {
  const starts = [];
  const ends = [];
  for (let i = 0; i < text.length; i++) {
    starts.push(charSecondsMap[i] ?? i * 0.07);
    ends.push(charSecondsMap[i] != null ? charSecondsMap[i] + 0.07 : i * 0.07 + 0.07);
  }
  return {
    source: 'elevenlabs',
    characters: text.split(''),
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
    normalized_text: text,
  };
}

// ── findAnchors ────────────────────────────────────────────────────────────────

describe('findAnchors', () => {
  it('returns [] when source is not elevenlabs', () => {
    const ts = makeTimestamps('In Texas, voters...');
    ts.source = 'openai';
    const result = findAnchors({
      locations: [{ name: 'Texas', lat: 30, lng: -97, iso: 'US' }],
      timestamps: ts,
      shotIsoCode: 'US',
    });
    expect(result).toEqual([]);
  });

  it('basic match — finds Texas in narration', () => {
    const text = 'In Texas, voters turned out in record numbers.';
    const charSecondsMap = { 3: 1.0 };
    const ts = makeTimestamps(text, charSecondsMap);

    const result = findAnchors({
      locations: [{ name: 'Texas', lat: 30, lng: -97, iso: 'US' }],
      timestamps: ts,
      shotIsoCode: 'US',
    });

    expect(result).toHaveLength(1);
    expect(result[0].locationIdx).toBe(0);
    expect(result[0].locationName).toBe('Texas');
    expect(Math.abs(result[0].secondsStart - 1.0)).toBeLessThan(0.05);
  });

  it('longest-match-first — Gaza City beats Gaza', () => {
    const text = 'Strikes hit Gaza City tonight.';
    const ts = makeTimestamps(text);

    const result = findAnchors({
      locations: [
        { name: 'Gaza', lat: 31.5, lng: 34.46, iso: 'PS' },
        { name: 'Gaza City', lat: 31.5, lng: 34.46, iso: 'PS' },
      ],
      timestamps: ts,
      shotIsoCode: 'PS',
    });

    expect(result).toHaveLength(1);
    expect(result[0].locationName).toBe('Gaza City');
  });

  it('alias match — U.S. resolves to United States', () => {
    const text = 'Tensions spread across the U.S. tonight.';
    const ts = makeTimestamps(text);

    const result = findAnchors({
      locations: [{ name: 'United States', lat: 37.09, lng: -95.71, iso: 'US' }],
      timestamps: ts,
      shotIsoCode: 'US',
    });

    expect(result).toHaveLength(1);
    expect(result[0].locationName).toBe('United States');
    expect(result[0].matchedText).toMatch(/U\.S\./);
  });

  it('disambiguation — US Georgia preferred over GE Georgia when shotIsoCode=US', () => {
    const text = 'Voters in Georgia went to the polls.';
    const ts = makeTimestamps(text);

    const locations = [
      { name: 'Georgia', lat: 42.3, lng: 43.3, iso: 'GE' },
      { name: 'Georgia', lat: 32.16, lng: -82.9, iso: 'US' },
    ];

    const result = findAnchors({ locations, timestamps: ts, shotIsoCode: 'US' });

    expect(result).toHaveLength(1);
    expect(locations[result[0].locationIdx].iso).toBe('US');
  });

  it('adjective match — Israeli resolves to Israel', () => {
    const text = 'The Israeli military confirmed the operation.';
    const ts = makeTimestamps(text);

    const result = findAnchors({
      locations: [{ name: 'Israel', lat: 31.0, lng: 34.85, iso: 'IL' }],
      timestamps: ts,
      shotIsoCode: 'IL',
    });

    expect(result).toHaveLength(1);
    expect(result[0].locationName).toBe('Israel');
    expect(result[0].matchedText).toBe('Israeli');
  });

  it('possessive match — Russia\'s resolves to Russia', () => {
    const text = "Russia's foreign minister responded.";
    const ts = makeTimestamps(text);

    const result = findAnchors({
      locations: [{ name: 'Russia', lat: 61.52, lng: 105.31, iso: 'RU' }],
      timestamps: ts,
      shotIsoCode: 'RU',
    });

    expect(result).toHaveLength(1);
    expect(result[0].matchedText).toBe("Russia's");
  });

  it('zero locations — returns []', () => {
    const text = 'Reporting from Israel tonight.';
    const ts = makeTimestamps(text);

    const result = findAnchors({ locations: [], timestamps: ts, shotIsoCode: null });

    expect(result).toEqual([]);
  });
});

// ── filterAnchors ──────────────────────────────────────────────────────────────

describe('filterAnchors', () => {
  function anchor(secondsStart, locationIdx, locationName) {
    return { locationIdx, locationName: locationName ?? `loc${locationIdx}`, secondsStart, secondsEnd: secondsStart + 0.5, charStart: 0, charEnd: 1, matchedText: 'x' };
  }

  it('collapses near-duplicate anchors — forward pass keeps lower-secondsStart winner', () => {
    // 2.0 vs 3.5: diff=1.5 < MIN_DWELL_S=1.8 → keep 2.0 (lower secondsStart), drop 3.5.
    // 3.8 vs last-kept 2.0: diff=1.8 which is NOT < 1.8 → keep 3.8.
    // Final: [2.0, 3.8].
    const anchors = [
      anchor(2.0, 0),
      anchor(3.5, 1),
      anchor(3.8, 2),
    ];
    const opts = { LEAD_TIME_S: 0.4, MIN_DWELL_S: 1.8, MERGE_SAME_LOCATION_S: 4 };
    const result = filterAnchors(anchors, opts);
    expect(result).toHaveLength(2);
    expect(result[0].secondsStart).toBe(2.0);
    expect(result[1].secondsStart).toBe(3.8);
  });

  it('collapses same-location repeats within MERGE_SAME_LOCATION_S', () => {
    const anchors = [
      anchor(2.0, 0),
      anchor(5.5, 0),
    ];
    const opts = { LEAD_TIME_S: 0.4, MIN_DWELL_S: 1.8, MERGE_SAME_LOCATION_S: 4 };
    const result = filterAnchors(anchors, opts);
    expect(result).toHaveLength(1);
    expect(result[0].secondsStart).toBe(2.0);
  });

  it('same-location repeat beyond MERGE_SAME_LOCATION_S both survive', () => {
    const anchors = [
      anchor(2.0, 0),
      anchor(8.0, 0),
    ];
    const opts = { LEAD_TIME_S: 0.4, MIN_DWELL_S: 1.8, MERGE_SAME_LOCATION_S: 4 };
    const result = filterAnchors(anchors, opts);
    expect(result).toHaveLength(2);
  });

  it('drops anchors within lead guard (< LEAD_TIME_S * 2)', () => {
    const anchors = [
      anchor(0.5, 0),
      anchor(2.0, 1),
    ];
    const result = filterAnchors(anchors, ANCHOR_DEFAULTS);
    expect(result).toHaveLength(1);
    expect(result[0].secondsStart).toBe(2.0);
  });

  it('uses ANCHOR_DEFAULTS when opts is not provided', () => {
    const anchors = [anchor(2.0, 0)];
    const result = filterAnchors(anchors);
    expect(result).toHaveLength(1);
  });
});

// ── buildAnchoredCameraPath ────────────────────────────────────────────────────

describe('buildAnchoredCameraPath', () => {
  const existingPath = [
    { tOffset: 0, lng: 35.0, lat: 31.0, zoom: 7, pitch: 50, bearing: -10 },
    { tOffset: 20, lng: 35.0, lat: 31.0, zoom: 7, pitch: 50, bearing: -10 },
  ];

  const locations = [
    { name: 'Israel', lat: 31.0, lng: 35.0, iso: 'IL' },
    { name: 'Iran', lat: 32.0, lng: 53.0, iso: 'IR' },
  ];

  function anchor(secondsStart, locationIdx, matchedText) {
    return {
      locationIdx,
      locationName: locations[locationIdx].name,
      secondsStart,
      secondsEnd: secondsStart + 0.4,
      charStart: 0,
      charEnd: matchedText?.length ?? 1,
      matchedText: matchedText ?? locations[locationIdx].name,
    };
  }

  it('zero anchors — returns existing cameraPath unchanged', () => {
    const result = buildAnchoredCameraPath(existingPath, [], locations, null, ANCHOR_DEFAULTS, 'narration text');
    expect(result.cameraPath).toBe(existingPath);
    expect(result.overlays).toEqual([]);
  });

  it('reveal intent — emits a start waypoint and a reveal waypoint', () => {
    const narration = 'Reporting from Israel tonight.';
    const anchors = [anchor(2.0, 0, 'Israel')];

    const result = buildAnchoredCameraPath(existingPath, anchors, locations, null, ANCHOR_DEFAULTS, narration);

    expect(result.overlays).toHaveLength(0);
    expect(result.cameraPath.length).toBeGreaterThanOrEqual(2);
    expect(result.cameraPath[0].tOffset).toBe(0);
  });

  it('data intent — emits overlay, no extra camera waypoint beyond start', () => {
    // "100 killed" should trigger DATA_RE
    const narration = '100 killed in the attack.';
    const anchors = [{
      locationIdx: 0,
      locationName: 'Israel',
      secondsStart: 2.0,
      secondsEnd: 2.4,
      charStart: 0,
      charEnd: 6,
      matchedText: '100 killed',
    }];

    const result = buildAnchoredCameraPath(existingPath, anchors, locations, null, ANCHOR_DEFAULTS, narration);

    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0].type).toBe('data-callout');
    // No camera waypoints beyond possibly the start duplicate
    expect(result.cameraPath.length).toBe(0);
  });

  it('hold intent — emits no waypoint and no overlay', () => {
    // A non-first occurrence with no special keywords
    const narration = 'Reporting continues from Israel. The Israel situation remains tense.';
    const anchorsArr = [
      { locationIdx: 0, locationName: 'Israel', secondsStart: 1.5, secondsEnd: 1.9, charStart: 22, charEnd: 28, matchedText: 'Israel' },
      { locationIdx: 0, locationName: 'Israel', secondsStart: 6.0, secondsEnd: 6.4, charStart: 34, charEnd: 40, matchedText: 'Israel' },
    ];

    const result = buildAnchoredCameraPath(existingPath, anchorsArr, locations, null, ANCHOR_DEFAULTS, narration);

    // Second anchor is "hold" intent — no extra waypoints from it
    const holdWaypoints = result.cameraPath.filter(wp => wp.tOffset >= 5.5);
    expect(holdWaypoints).toHaveLength(0);
  });

  it('stakes intent — inherits previous position, zoom increases', () => {
    // Craft narration so each anchor's matchedText is unique to one sentence.
    // First anchor: matchedText 'Iranian' appears only in sentence 1 → reveal intent.
    // Second anchor (same location Israel, idx 0): matchedText 'Israel' appears only in
    // sentence 2 (which has a stakes keyword) → stakes intent.
    const narration = 'The Iranian government condemned the strike. Israel may escalate the conflict.';
    const anchorsArr = [
      { locationIdx: 0, locationName: 'Israel', secondsStart: 1.5, secondsEnd: 1.9, charStart: 4, charEnd: 10, matchedText: 'Iranian' },
      { locationIdx: 0, locationName: 'Israel', secondsStart: 4.0, secondsEnd: 4.4, charStart: 45, charEnd: 51, matchedText: 'Israel' },
    ];

    const result = buildAnchoredCameraPath(existingPath, anchorsArr, locations, null, ANCHOR_DEFAULTS, narration);

    const stakesWp = result.cameraPath.find(wp => wp.tOffset >= 4.0 - ANCHOR_DEFAULTS.LEAD_TIME_S - 0.1);
    expect(stakesWp).toBeDefined();
    const revealWp = result.cameraPath.find(wp => wp.tOffset > 0 && wp.tOffset < stakesWp.tOffset);
    expect(revealWp).toBeDefined();
    expect(stakesWp.zoom).toBeGreaterThan(revealWp.zoom);
  });

  it('contrast intent — emits a pull-back midpoint waypoint', () => {
    const narration = 'Reporting from Israel. But Iran denies involvement.';
    const anchorsArr = [
      anchor(1.5, 0, 'Israel'),
      anchor(4.5, 1, 'Iran'),
    ];

    const result = buildAnchoredCameraPath(existingPath, anchorsArr, locations, null, ANCHOR_DEFAULTS, narration);

    expect(result.cameraPath.length).toBeGreaterThanOrEqual(2);
    // The contrast waypoint should be between Israel (lng 35) and Iran (lng 53)
    const contrastWp = result.cameraPath[result.cameraPath.length - 1];
    // Midpoint longitude must be strictly between the two source longitudes (35 and 53)
    expect(contrastWp.lng).toBeGreaterThan(35);
    expect(contrastWp.lng).toBeLessThan(53);
  });

  it('prepends a tOffset=0 start waypoint when first anchor is at tOffset > 0', () => {
    const narration = 'Reporting from Israel tonight.';
    const anchors = [anchor(3.0, 0, 'Israel')];

    const result = buildAnchoredCameraPath(existingPath, anchors, locations, null, ANCHOR_DEFAULTS, narration);

    expect(result.cameraPath[0].tOffset).toBe(0);
    expect(result.cameraPath.length).toBeGreaterThanOrEqual(2);
    expect(result.cameraPath[0].lng).toBe(result.cameraPath[1].lng);
  });

  it('clamps overlay durationMs when shotHold is provided', () => {
    const narration = '100 killed in the attack on Israel.';
    const anchors = [{
      locationIdx: 0,
      locationName: 'Israel',
      secondsStart: 9.5,
      secondsEnd: 9.9,
      charStart: 0,
      charEnd: 6,
      matchedText: '100 killed',
    }];

    const result = buildAnchoredCameraPath(existingPath, anchors, locations, null, ANCHOR_DEFAULTS, narration, 10.0);

    expect(result.overlays).toHaveLength(1);
    const overlay = result.overlays[0];
    expect(overlay.tOffset + overlay.durationMs / 1000).toBeLessThanOrEqual(10.0 - 0.05 + 0.001);
  });
});

describe('findQuoteOverlays', () => {
  function makeTsFromNormalized(normalized) {
    const chars = normalized.split('');
    return {
      source: 'elevenlabs',
      normalized_text: normalized,
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds:   chars.map((_, i) => (i + 1) * 0.1),
    };
  }

  it('detects a quoted phrase and returns a quote-callout overlay', () => {
    const narration   = 'He said "we will not yield" and left.';
    // ElevenLabs normalized_text typically omits the outer quote marks.
    const normalized  = 'He said we will not yield and left.';
    const ts          = makeTsFromNormalized(normalized);
    const overlays    = findQuoteOverlays({ narration, timestamps: ts, shotHold: 30 });

    expect(overlays).toHaveLength(1);
    expect(overlays[0].type).toBe('quote-callout');
    expect(overlays[0].text).toBe('we will not yield');
    // "we" starts at index 8 in normalized → t = 0.8
    expect(overlays[0].tOffset).toBeCloseTo(0.8, 1);
    expect(overlays[0].durationMs).toBeGreaterThan(0);
  });

  it('returns [] when source is not elevenlabs', () => {
    const overlays = findQuoteOverlays({
      narration: 'He said "hello"',
      timestamps: { source: null },
      shotHold: 30,
    });
    expect(overlays).toEqual([]);
  });

  it('returns [] when narration has no quotes', () => {
    const normalized = 'No quotes here at all.';
    const ts = makeTsFromNormalized(normalized);
    expect(findQuoteOverlays({ narration: 'No quotes here at all.', timestamps: ts, shotHold: 30 })).toEqual([]);
  });

  it('detects multiple quoted phrases', () => {
    const narration  = '"first quote" then "second quote" done.';
    const normalized = 'first quote then second quote done.';
    const ts         = makeTsFromNormalized(normalized);
    const overlays   = findQuoteOverlays({ narration, timestamps: ts, shotHold: 30 });
    expect(overlays).toHaveLength(2);
    expect(overlays[0].text).toBe('first quote');
    expect(overlays[1].text).toBe('second quote');
  });

  it('clamps durationMs to not exceed shotHold', () => {
    const narration  = '"long quote here"';
    const normalized = 'long quote here';
    const ts         = makeTsFromNormalized(normalized);
    const overlays   = findQuoteOverlays({ narration, timestamps: ts, shotHold: 1.2 });
    if (overlays.length > 0) {
      const ov = overlays[0];
      expect(ov.tOffset + ov.durationMs / 1000).toBeLessThanOrEqual(1.2);
    }
  });

  it('skips very short quoted spans (< 3 chars)', () => {
    const narration  = 'Said "hi" and "bye now".';
    const normalized = 'Said hi and bye now.';
    const ts         = makeTsFromNormalized(normalized);
    const overlays   = findQuoteOverlays({ narration, timestamps: ts, shotHold: 30 });
    // "hi" is 2 chars — skipped. "bye now" is 7 — kept.
    expect(overlays).toHaveLength(1);
    expect(overlays[0].text).toBe('bye now');
  });
});
