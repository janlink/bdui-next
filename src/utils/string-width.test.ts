import { describe, expect, test } from 'bun:test';
import stringWidth, { getAmbiguousWidth, setAmbiguousWidth } from 'string-width';

const ESC = String.fromCharCode(27);

describe('string-width override', () => {
  test('measures the glyph classes the TUI renders', () => {
    const cases: Array<[string, number]> = [
      ['', 0],
      ['a', 1],
      ['bd-0042', 7],
      ['Rückläufer öffnen', 17],
      ['▸', 1],
      ['└─', 2],
      ['│  ', 3],
      ['○◐●✓◊∙', 6],
      ['▋█▒', 3],
      ['↑↓…', 3],
      ['日本語', 6],
      ['한국어', 6],
      ['👍', 2],
      ['👨‍👩‍👧‍👦', 2],
      ['🇩🇪', 2],
      ['▋○ │  ▾ bd-0042             epic Titel', 38],
    ];

    for (const [value, expected] of cases) {
      expect(stringWidth(value)).toBe(expected);
    }
  });

  test('measures East Asian Ambiguous characters as the session decided', () => {
    try {
      expect(getAmbiguousWidth()).toBe('narrow');
      expect(stringWidth('│─○')).toBe(3);

      setAmbiguousWidth('wide');
      expect(getAmbiguousWidth()).toBe('wide');
      expect(stringWidth('│─○')).toBe(6);
      // Neutral characters are unaffected, which is why a width-measured column
      // has to pad to the widest of the characters that share it.
      expect(stringWidth('✓◊∙')).toBe(3);
    } finally {
      setAmbiguousWidth('narrow');
    }
  });

  test('takes an explicit ambiguous width over the session default', () => {
    expect(stringWidth('│', { ambiguousIsNarrow: false })).toBe(2);
    expect(stringWidth('│', { ambiguousIsNarrow: true })).toBe(1);
  });

  test('ignores ANSI escape sequences by default and counts them on request', () => {
    const colored = `${ESC}[36mbd-0042${ESC}[39m`;
    expect(stringWidth(colored)).toBe(7);
    // The escape characters themselves stay zero-width, so only the printable
    // parts of the sequence are counted: "[36m" + "bd-0042" + "[39m".
    expect(stringWidth(colored, { countAnsiEscapeCodes: true })).toBe(15);
  });

  test('stays fast enough for Ink\'s per-character measurement', () => {
    // Ink calls stringWidth once per rendered character per frame. The published
    // Intl.Segmenter implementation needs ~26 us per call under Bun, which puts a
    // full frame far past the 33 ms frame budget.
    const characters = '  │▾○●✓abcdefgh0123456789'.split('');
    const start = Bun.nanoseconds();
    for (let i = 0; i < 2000; i++) {
      stringWidth(characters[i % characters.length]!);
    }
    const elapsedMs = (Bun.nanoseconds() - start) / 1e6;

    expect(elapsedMs).toBeLessThan(20);
  });
});
