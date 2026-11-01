import { describe, it, expect } from 'vitest';
import { buildGroupedItems, buildThreads } from '../openStory.js';

const story = (id, outlets) => ({ id, headline: id, articles: outlets.map(source => ({ source })) });
const outlets = (n, prefix = 'O') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('buildThreads', () => {
  const lead = story('lead', outlets(8));
  const mid = story('mid', outlets(3, 'M'));
  const solo = story('solo', ['S0']);
  const wide = story('wide', outlets(5, 'W'));

  it('makes one compared thread per multi-outlet member plus a singles thread', () => {
    const { compared, singles } = buildThreads([lead, mid, solo], lead);
    expect(compared.map(s => s.id)).toEqual(['lead', 'mid']);
    expect(singles.map(s => s.id)).toEqual(['solo']);
  });

  it('keeps every story in the group reachable', () => {
    const all = [lead, mid, solo, wide];
    const { compared, singles } = buildThreads(all, lead);
    expect([...compared, ...singles].map(s => s.id).sort()).toEqual(all.map(s => s.id).sort());
  });

  it('orders members by outlet count with the lead first', () => {
    const { compared } = buildThreads([mid, wide, lead], lead);
    expect(compared.map(s => s.id)).toEqual(['lead', 'wide', 'mid']);
  });

  it('keeps a single-outlet lead as the first thread', () => {
    const { compared, singles } = buildThreads([solo, mid], solo);
    expect(compared.map(s => s.id)).toEqual(['solo', 'mid']);
    expect(singles).toEqual([]);
  });
});

describe('buildGroupedItems', () => {
  it('dedupes repeated story ids inside a group', () => {
    const a = story('story-1', outlets(3));
    const b = story('story-2', ['X']);
    const byId = new Map([a, b].map(s => [s.id, s]));
    const groups = [{ id: 'g1', label: 'G', storyIds: ['story-1', 'story-2', 'story-2'] }];
    const [item] = buildGroupedItems([a], groups, byId);
    expect(item.type).toBe('group');
    expect(item.stories.map(s => s.id)).toEqual(['story-1', 'story-2']);
  });

  it('returns plain story items when the report has no groups', () => {
    const a = story('story-1', outlets(2));
    expect(buildGroupedItems([a], [], new Map())).toEqual([{ type: 'story', story: a }]);
  });
});
