import { leanOf, outletsByLean } from './shared/source-leans.js';

export const LEAN_KEYS = ['left', 'center', 'right'];
export const LEAN_LABELS = { left: 'Left', center: 'Center', right: 'Right' };

export function coveringOutlets(articles) {
  return [...new Set((articles ?? []).map(a => a.source))];
}

export function buildGroupedItems(orderedStories, storyGroups, allStoriesById) {
  if (!storyGroups?.length) return orderedStories.map(s => ({ type: 'story', story: s }));

  const groupById = new Map(storyGroups.map(g => [g.id, g]));
  const storyGroupId = new Map();
  for (const g of storyGroups) {
    for (const id of g.storyIds) storyGroupId.set(id, g.id);
  }

  const rendered = new Set();
  const items = [];

  for (const story of orderedStories) {
    if (rendered.has(story.id)) continue;
    const gid = storyGroupId.get(story.id);
    if (gid && groupById.has(gid)) {
      const group = groupById.get(gid);
      // Reports can list the same id twice in a group; dedupe so counts and React keys stay correct.
      const groupStories = [...new Set(group.storyIds)].map(id => allStoriesById.get(id)).filter(Boolean);
      groupStories.forEach(s => rendered.add(s.id));
      const sources = [...new Set(groupStories.flatMap(s => (s.articles ?? []).map(a => a?.source).filter(Boolean)))];
      items.push({ type: 'group', group, stories: groupStories, lead: story, sources });
    } else {
      rendered.add(story.id);
      items.push({ type: 'story', story });
    }
  }
  return items;
}

// Splits a group's stories into compared threads (the lead first, then every other
// multi-outlet member by outlet count) and the single-outlet reports.
export function buildThreads(groupStories, lead) {
  const count = s => coveringOutlets(s.articles).length;
  const others = groupStories.filter(s => s.id !== lead.id);
  const compared = [lead, ...others.filter(s => count(s) >= 2).sort((a, b) => count(b) - count(a))];
  const singles = others.filter(s => count(s) < 2);
  return { compared, singles };
}

// Normalizes the current claims[] shape and the two legacy shapes
// (agreements[] + uniqueAngles[], and single-source facts[]) into one claim list.
export function normalizeClaims(analysis, articles) {
  if (!analysis) return [];
  if (Array.isArray(analysis.claims)) {
    return analysis.claims.map(c => ({
      statement: c.statement,
      sources: c.sources ?? [],
      contested: Array.isArray(c.contested) ? c.contested : [],
    }));
  }
  const out = [];
  for (const a of analysis.agreements ?? []) {
    out.push({ statement: a, sources: [], contested: [], assumedMulti: true });
  }
  for (const u of analysis.uniqueAngles ?? []) {
    out.push({ statement: u.angle ?? u.position, sources: u.source ? [u.source] : [], contested: [] });
  }
  const only = coveringOutlets(articles);
  for (const f of analysis.facts ?? []) {
    out.push({ statement: f, sources: only.length === 1 ? only : [], contested: [] });
  }
  return out;
}

export function claimTier(claim, leans) {
  const spanned = new Set(claim.sources.map(s => leanOf(leans, s)).filter(Boolean));
  if (LEAN_KEYS.every(k => spanned.has(k))) return 'spectrum';
  if (claim.sources.length >= 2 || claim.assumedMulti) return 'multi';
  return 'single';
}

export function groupClaimsByTier(claims, leans) {
  const tiers = { spectrum: [], multi: [], single: [] };
  for (const c of claims) tiers[claimTier(c, leans)].push(c);
  for (const t of Object.values(tiers)) {
    t.sort((a, b) => b.sources.length - a.sources.length);
  }
  return tiers;
}

export function coverageByLean(leans, articles) {
  const covered = new Set(coveringOutlets(articles));
  const groups = outletsByLean(leans);
  const result = {};
  for (const k of LEAN_KEYS) {
    result[k] = groups[k].map(name => ({ name, covered: covered.has(name) }));
  }
  return result;
}

export function gapNote(coverage) {
  const present = LEAN_KEYS.filter(k => coverage[k].some(o => o.covered));
  const missing = LEAN_KEYS.filter(k => coverage[k].length > 0 && !coverage[k].some(o => o.covered));
  if (present.length === 0 || missing.length === 0) return '';
  if (present.length === 1) return `Only ${present[0]}-leaning outlets covered this`;
  return `No ${missing[0]}-leaning outlet covered this`;
}

export function headlinesByLean(articles, leans) {
  const cols = { left: [], center: [], right: [], other: [] };
  for (const a of articles ?? []) {
    const lean = leanOf(leans, a.source);
    cols[lean ?? 'other'].push(a);
  }
  return cols;
}
