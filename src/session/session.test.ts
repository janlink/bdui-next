import { describe, expect, test } from 'bun:test';
import { chalkLevelFor, depthFromChalkLevel, resolveColorDepth } from './colors';
import { Readable } from 'node:stream';
import {
  DEFAULT_AMBIGUOUS_WIDTH,
  probeAmbiguousWidth,
  resolveAmbiguousWidth,
  widthFromProbeColumn,
} from './ambiguous';
import { GLYPH_TIERS, getGlyphs, resolveGlyphTier } from './glyphs';
import { glyphCheckText, handleCliArgs, HELP_TEXT } from '../cli';

describe('colour depth', () => {
  test.each([
    [3, 'ansi256'],
    [2, 'ansi256'],
    [1, 'ansi16'],
    [0, 'none'],
  ] as const)('chalk level %i means %s', (level, depth) => {
    expect(depthFromChalkLevel(level)).toBe(depth);
    expect(resolveColorDepth({}, level)).toBe(depth);
  });

  test.each([
    ['256', 'ansi256'],
    ['16', 'ansi16'],
    ['none', 'none'],
  ] as const)('BDUI_COLOR=%s overrides the detection', (value, depth) => {
    expect(resolveColorDepth({ BDUI_COLOR: value }, 3)).toBe(depth);
    expect(resolveColorDepth({ BDUI_COLOR: value }, 0)).toBe(depth);
  });

  test('honours NO_COLOR, which chalk itself ignores', () => {
    expect(resolveColorDepth({ NO_COLOR: '1' }, 3)).toBe('none');
    expect(resolveColorDepth({ NO_COLOR: '' }, 3)).toBe('ansi256');
  });

  test('lets an explicit request win over NO_COLOR', () => {
    expect(resolveColorDepth({ NO_COLOR: '1', BDUI_COLOR: '256' }, 0)).toBe('ansi256');
  });

  test('falls back to the detection for auto and for nonsense', () => {
    expect(resolveColorDepth({ BDUI_COLOR: 'auto' }, 1)).toBe('ansi16');
    expect(resolveColorDepth({ BDUI_COLOR: 'chartreuse' }, 1)).toBe('ansi16');
  });

  test('maps back to a chalk level Ink can render at', () => {
    expect(chalkLevelFor('ansi256')).toBe(2);
    expect(chalkLevelFor('ansi16')).toBe(1);
    expect(chalkLevelFor('none')).toBe(0);
  });
});

describe('glyph tier', () => {
  test.each(['fancy', 'safe', 'ascii'] as const)('BDUI_GLYPHS=%s selects it', tier => {
    expect(resolveGlyphTier({ BDUI_GLYPHS: tier })).toBe(tier);
  });

  test('stays optimistic when nothing asks otherwise', () => {
    expect(resolveGlyphTier({})).toBe('fancy');
    expect(resolveGlyphTier({ BDUI_GLYPHS: 'auto' })).toBe('fancy');
  });

  test('fills every slot in every tier', () => {
    const slots = Object.keys(getGlyphs('fancy')).sort();
    for (const tier of GLYPH_TIERS) {
      const glyphs = getGlyphs(tier);
      expect(Object.keys(glyphs).sort()).toEqual(slots);
      for (const [slot, value] of Object.entries(glyphs)) {
        if (slot === 'tier' || slot === 'border') continue;
        expect(value).not.toBe('');
      }
    }
  });

  test('keeps the ascii tier inside ASCII', () => {
    for (const [slot, value] of Object.entries(getGlyphs('ascii'))) {
      if (slot === 'tier' || slot === 'border') continue;
      expect(value).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  test('never emits a variation selector, which terminals size unpredictably', () => {
    for (const tier of GLYPH_TIERS) {
      for (const value of Object.values(getGlyphs(tier))) {
        if (typeof value !== 'string') continue;
        expect(value).not.toMatch(/[︎️]/);
      }
    }
  });

  test('maps the border styles a tier cannot draw', () => {
    expect(getGlyphs('fancy').border('round')).toBe('round');
    expect(getGlyphs('safe').border('round')).toBe('single');
    expect(getGlyphs('safe').border('double')).toBe('double');
    expect(getGlyphs('ascii').border('double')).toBe('classic');
  });

  test('carries a single-glyph card band per tier', () => {
    expect(getGlyphs('fancy').band).toBe('▏');
    expect(getGlyphs('safe').band).toBe('│');
    expect(getGlyphs('ascii').band).toBe('|');
    for (const tier of GLYPH_TIERS) {
      expect([...getGlyphs(tier).band]).toHaveLength(1);
    }
  });
});

describe('ambiguous width', () => {
  const noProbe = async () => {
    throw new Error('the probe must not run when the environment already decided');
  };

  test.each(['narrow', 'wide'] as const)('BDUI_AMBIGUOUS=%s skips the probe', async width => {
    expect(await resolveAmbiguousWidth({ BDUI_AMBIGUOUS: width }, noProbe)).toBe(width);
  });

  test('probes for auto', async () => {
    expect(await resolveAmbiguousWidth({ BDUI_AMBIGUOUS: 'auto' }, async () => 'wide')).toBe('wide');
    expect(await resolveAmbiguousWidth({}, async () => 'wide')).toBe('wide');
  });

  test('keeps the narrow default for an unrecognised value', async () => {
    expect(await resolveAmbiguousWidth({ BDUI_AMBIGUOUS: 'double' }, noProbe))
      .toBe(DEFAULT_AMBIGUOUS_WIDTH);
  });

  test('reads the reported column as the width of one probe character', () => {
    expect(widthFromProbeColumn(2)).toBe('narrow');
    expect(widthFromProbeColumn(3)).toBe('wide');
  });
});

describe('informational flags', () => {
  test('--glyph-check prints every tier', () => {
    const written: string[] = [];
    expect(handleCliArgs(['--glyph-check'], message => written.push(message))).toBe(true);
    const output = written.join('\n');
    for (const tier of GLYPH_TIERS) {
      expect(output).toContain(tier);
    }
    expect(output).toContain(getGlyphs('ascii').gutter);
  });

  test('--glyph-check samples the tiers without touching the terminal', () => {
    expect(glyphCheckText()).toContain('BDUI_GLYPHS');
  });

  test('--help documents the session switches', () => {
    for (const name of ['BDUI_GLYPHS', 'BDUI_COLOR', 'BDUI_AMBIGUOUS', 'NO_COLOR']) {
      expect(HELP_TEXT).toContain(name);
    }
  });
});

describe('ambiguous width probe', () => {
  const CPR = (column: number) => `\x1b[45;${column}R`;

  function fakeTerminal(tty = true) {
    const input = new Readable({ read() {} }) as NodeJS.ReadStream;
    Object.assign(input, {
      isTTY: tty,
      isRaw: false,
      setRawMode(mode: boolean) {
        this.isRaw = mode;
        return this;
      },
    });
    const written: string[] = [];
    const output = {
      isTTY: tty,
      write(text: string) {
        written.push(text);
        return true;
      },
    } as unknown as NodeJS.WriteStream;
    return { input, output, written };
  }

  // Ink consumes stdin through 'readable' and read(); a consumer wired the same
  // way must see every byte the probe did not claim for itself.
  function drainLikeInk(input: NodeJS.ReadStream): Promise<string> {
    return new Promise(resolve => {
      let seen = '';
      input.addListener('readable', () => {
        let chunk: Buffer | string | null;
        while ((chunk = input.read()) !== null) seen += chunk.toString();
        if (seen.length > 0) resolve(seen);
      });
    });
  }

  test('asks the terminal and reads the width off the answer', async () => {
    const { input, output, written } = fakeTerminal();
    const probe = probeAmbiguousWidth({ input, output });
    expect(written.join('')).toContain('\x1b[6n');
    input.push(CPR(3));
    expect(await probe).toBe('wide');
  });

  test('narrow when the cursor moved one column', async () => {
    const { input, output } = fakeTerminal();
    const probe = probeAmbiguousWidth({ input, output });
    input.push(CPR(2));
    expect(await probe).toBe('narrow');
  });

  test('hands keystrokes around the answer on to the next consumer', async () => {
    const { input, output } = fakeTerminal();
    const probe = probeAmbiguousWidth({ input, output });
    input.push(`a${CPR(2)}b`);
    expect(await probe).toBe('narrow');
    expect(input.listenerCount('readable')).toBe(0);
    expect(input.listenerCount('data')).toBe(0);
    expect(await drainLikeInk(input)).toBe('ab');
  });

  test('keeps the stream readable for Ink after a split answer', async () => {
    const { input, output } = fakeTerminal();
    const probe = probeAmbiguousWidth({ input, output });
    input.push('\x1b[45');
    input.push(';3R');
    expect(await probe).toBe('wide');
    const next = drainLikeInk(input);
    input.push('q');
    expect(await next).toBe('q');
  });

  test('falls back to narrow when the terminal stays silent, without eating keys', async () => {
    const { input, output } = fakeTerminal();
    const probe = probeAmbiguousWidth({ input, output });
    input.push('j');
    expect(await probe).toBe(DEFAULT_AMBIGUOUS_WIDTH);
    expect(input.listenerCount('readable')).toBe(0);
    expect(await drainLikeInk(input)).toBe('j');
  });

  test('restores the raw-mode state it found', async () => {
    const { input, output } = fakeTerminal();
    const probe = probeAmbiguousWidth({ input, output });
    expect(input.isRaw).toBe(true);
    input.push(CPR(2));
    await probe;
    expect(input.isRaw).toBe(false);
  });

  test('does not touch a stream that is not a terminal', async () => {
    const { input, output, written } = fakeTerminal(false);
    expect(await probeAmbiguousWidth({ input, output })).toBe(DEFAULT_AMBIGUOUS_WIDTH);
    expect(written).toEqual([]);
  });
});
