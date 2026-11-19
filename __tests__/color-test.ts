import { describe, expect, it } from '@jest/globals';

import { buildTheme, PRESETS } from '@/lib/appearance';
import { contrast, ensureContrast, hexToHsv, hsvToHex, mix, normalizeHex, readableOn } from '@/lib/color';

describe('color helpers', () => {
  it('normalizes hex', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('e4572e')).toBe('#E4572E');
    expect(normalizeHex('nope')).toBeNull();
  });

  it('round-trips HSV', () => {
    for (const hex of ['#E4572E', '#1E88E5', '#000000', '#FFFFFF', '#52525B']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
  });

  it('mixes', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#123456', '#FFFFFF', 0)).toBe('#123456');
  });

  it('picks readable text', () => {
    expect(readableOn('#FFFF00')).toBe('#000000');
    expect(readableOn('#1A237E')).toBe('#FFFFFF');
  });

  it('lifts a colour that would vanish on the background', () => {
    const c = ensureContrast('#111111', '#000000', 3);
    expect(contrast(c, '#000000')).toBeGreaterThanOrEqual(3);
    expect(ensureContrast('#E4572E', '#FFFFFF', 3)).toBe('#E4572E');
  });
});

describe('buildTheme', () => {
  it('keeps every preset readable in both modes', () => {
    for (const { palette } of PRESETS) {
      for (const scheme of ['light', 'dark'] as const) {
        const t = buildTheme(scheme, palette);
        expect(contrast(t.accent, t.background)).toBeGreaterThanOrEqual(3);
        expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(3);
        expect(contrast(t.text, t.backgroundElement)).toBeGreaterThanOrEqual(7);
        expect(contrast(t.text, t.backgroundSelected)).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('keeps text readable even with extreme custom colours', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const t = buildTheme(scheme, { main: '#FFFF00', secondary: '#FFFFFF', tertiary: '#000000' });
      expect(contrast(t.text, t.backgroundElement)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.text, t.backgroundSelected)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, t.background)).toBeGreaterThanOrEqual(3);
    }
  });
});
