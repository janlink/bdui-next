import chalk from 'chalk';

export type ColorDepth = 'ansi256' | 'ansi16' | 'none';

export const COLOR_DEPTHS: readonly ColorDepth[] = ['ansi256', 'ansi16', 'none'] as const;

export const DEFAULT_COLOR_DEPTH: ColorDepth = 'ansi256';

const REQUESTED: Record<string, ColorDepth> = {
  '256': 'ansi256',
  ansi256: 'ansi256',
  truecolor: 'ansi256',
  '16': 'ansi16',
  ansi16: 'ansi16',
  basic: 'ansi16',
  none: 'none',
  off: 'none',
  '0': 'none',
};

export function depthFromChalkLevel(level: number): ColorDepth {
  if (level >= 2) return 'ansi256';
  if (level === 1) return 'ansi16';
  return 'none';
}

export function chalkLevelFor(depth: ColorDepth): 0 | 1 | 2 {
  if (depth === 'ansi256') return 2;
  if (depth === 'ansi16') return 1;
  return 0;
}

/**
 * BDUI_COLOR overrides the detection in both directions. FORCE_COLOR is a floor
 * that chalk applies at import and cannot be lowered again through the
 * environment, so an own switch is the only way to ask for fewer colours.
 * NO_COLOR is honoured here because chalk itself does not.
 */
export function resolveColorDepth(
  env: Record<string, string | undefined> = process.env,
  detectedLevel: number = chalk.level,
): ColorDepth {
  const requested = env.BDUI_COLOR?.trim().toLowerCase();
  if (requested && requested !== 'auto') {
    const depth = REQUESTED[requested];
    if (depth) return depth;
  }
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'none';
  return depthFromChalkLevel(detectedLevel);
}

/**
 * chalk reads the terminal once at import and freezes the result, so the shared
 * default instance Ink writes through has to be told the resolved depth.
 */
export function applyColorDepth(depth: ColorDepth): void {
  chalk.level = chalkLevelFor(depth);
}
