import { describe, it, expect } from 'vitest';
import {
  ACCENT, ACCENT_TEXT, TEXT_60, TEXT_55, BG_OVERLAY,
  CHYRON_UPPER, CHYRON_LOWER, BORDER_ACTIVE, BORDER_HERO,
} from '../tokens.js';

describe('tokens', () => {
  it('ACCENT is the gold color', () => {
    expect(ACCENT).toBe('#e8c547');
  });
  it('BG_OVERLAY is dark semi-transparent', () => {
    expect(BG_OVERLAY).toMatch(/rgba\(10,13,20/);
  });
  it('all exports are strings', () => {
    const vals = [ACCENT, ACCENT_TEXT, TEXT_60, TEXT_55, BG_OVERLAY,
                  CHYRON_UPPER, CHYRON_LOWER, BORDER_ACTIVE, BORDER_HERO];
    for (const v of vals) expect(typeof v).toBe('string');
  });
});
