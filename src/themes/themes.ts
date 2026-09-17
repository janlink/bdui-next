import { DEFAULT_COLOR_DEPTH, type ColorDepth } from '../session/colors';

// A theme exists once per colour depth. The 256-colour tables name app-owned
// indices, which no terminal theme can redefine; the 16-colour tables name roles
// (0-15), which every terminal theme redefines on purpose. chalk passes
// `ansi256(N)` through unchanged at level 1 instead of downsampling it, so the
// two tables cannot be derived from each other.

/** What a `<Text>` needs to render one rung of the brightness ladder. */
export interface TextStyle {
  color: string;
  bold?: boolean;
  dimColor?: boolean;
}

/**
 * The five rungs hierarchy is expressed in. Colour carries status, brightness
 * carries depth, so the rungs stay the same in every theme.
 */
export interface Ladder {
  strong: TextStyle;
  text: TextStyle;
  dim: TextStyle;
  faint: TextStyle;
  rule: TextStyle;
}

export interface ThemeColors {
  statusOpen: string;
  statusInProgress: string;
  statusBlocked: string;
  statusClosed: string;
  statusDeferred: string;
  statusOther: string;

  priorityCritical: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  priorityLowest: string;

  typeEpic: string;
  typeFeature: string;
  typeBug: string;
  typeTask: string;
  typeChore: string;
  typeDecision: string;
  typeOther: string;

  textStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  rule: string;

  primary: string;
  border: string;
  surface: string;
  surfaceSel: string;

  success: string;
  error: string;
  warning: string;
}

export interface Selection {
  backgroundColor?: string;
  inverse?: boolean;
}

export interface Theme {
  name: string;
  label: string;
  depth: ColorDepth;
  colors: ThemeColors;
  ink: Ladder;
  /** `ink` lifted one rung, for the row under the selection surface. */
  inkSelected: Ladder;
  selection: Selection;
}

const c = (index: number): string => `ansi256(${index})`;

interface Palette {
  label: string;
  status: [open: number, inProgress: number, blocked: number, closed: number, deferred: number];
  priority: [number, number, number, number, number];
  type: [epic: number, feature: number, bug: number, decision: number];
}

const PALETTES: Record<string, Palette> = {
  default: {
    label: 'Default',
    status: [75, 214, 203, 65, 245],
    priority: [203, 209, 215, 244, 239],
    type: [141, 72, 209, 177],
  },
  ocean: {
    label: 'Ocean',
    status: [39, 80, 168, 66, 245],
    priority: [168, 174, 180, 244, 239],
    type: [117, 79, 175, 153],
  },
  forest: {
    label: 'Forest',
    status: [71, 143, 131, 65, 245],
    priority: [131, 137, 143, 244, 239],
    type: [108, 77, 167, 144],
  },
  sunset: {
    label: 'Sunset',
    status: [209, 215, 197, 101, 245],
    priority: [197, 203, 209, 244, 239],
    type: [176, 179, 203, 212],
  },
  monochrome: {
    label: 'Monochrome',
    status: [245, 252, 231, 240, 238],
    priority: [231, 250, 244, 240, 238],
    type: [255, 250, 250, 247],
  },
};

const NEUTRAL_TYPE = 242;
const OTHER_STATUS = 242;

const LADDER_256: Ladder = {
  strong: { color: c(255) },
  text: { color: c(253) },
  dim: { color: c(248) },
  faint: { color: c(243) },
  rule: { color: c(239) },
};

// Indices 0-15 offer no brightness ramp, so the rungs fall back to attributes.
const LADDER_16: Ladder = {
  strong: { color: 'white', bold: true },
  text: { color: 'white' },
  dim: { color: 'gray' },
  faint: { color: 'gray', dimColor: true },
  rule: { color: 'gray', dimColor: true },
};

const LADDER_NONE: Ladder = {
  strong: { color: '' },
  text: { color: '' },
  dim: { color: '' },
  faint: { color: '' },
  rule: { color: '' },
};

function lift(ladder: Ladder): Ladder {
  return {
    strong: ladder.strong,
    text: ladder.strong,
    dim: ladder.text,
    faint: ladder.dim,
    rule: ladder.faint,
  };
}

function theme256(name: string, palette: Palette): Theme {
  const [open, inProgress, blocked, closed, deferred] = palette.status;
  const [critical, high, medium, low, lowest] = palette.priority;
  const [epic, feature, bug, decision] = palette.type;
  return {
    name,
    label: palette.label,
    depth: 'ansi256',
    colors: {
      statusOpen: c(open),
      statusInProgress: c(inProgress),
      statusBlocked: c(blocked),
      statusClosed: c(closed),
      statusDeferred: c(deferred),
      statusOther: c(OTHER_STATUS),

      priorityCritical: c(critical),
      priorityHigh: c(high),
      priorityMedium: c(medium),
      priorityLow: c(low),
      priorityLowest: c(lowest),

      typeEpic: c(epic),
      typeFeature: c(feature),
      typeBug: c(bug),
      typeTask: c(NEUTRAL_TYPE),
      typeChore: c(NEUTRAL_TYPE),
      typeDecision: c(decision),
      typeOther: c(NEUTRAL_TYPE),

      textStrong: LADDER_256.strong.color,
      text: LADDER_256.text.color,
      textDim: LADDER_256.dim.color,
      textFaint: LADDER_256.faint.color,
      rule: LADDER_256.rule.color,

      primary: c(open),
      border: c(236),
      surface: c(234),
      surfaceSel: c(235),

      success: c(closed),
      error: c(blocked),
      warning: c(inProgress),
    },
    ink: LADDER_256,
    inkSelected: lift(LADDER_256),
    selection: { backgroundColor: c(235) },
  };
}

interface Palette16 {
  status: [string, string, string, string];
  priority: [string, string, string, string, string];
  type: [epic: string, feature: string, bug: string, task: string, decision: string];
  primary: string;
  success: string;
  error: string;
  warning: string;
}

const PALETTES_16: Record<string, Palette16> = {
  default: {
    status: ['blue', 'yellow', 'red', 'green'],
    priority: ['red', 'yellow', 'cyan', 'blue', 'gray'],
    type: ['magenta', 'green', 'red', 'blue', 'cyan'],
    primary: 'cyan',
    success: 'green',
    error: 'red',
    warning: 'yellow',
  },
  ocean: {
    status: ['cyan', 'blue', 'magenta', 'green'],
    priority: ['magenta', 'blue', 'cyan', 'green', 'gray'],
    type: ['blue', 'cyan', 'magenta', 'green', 'white'],
    primary: 'cyan',
    success: 'green',
    error: 'magenta',
    warning: 'blue',
  },
  forest: {
    status: ['green', 'yellow', 'red', 'cyan'],
    priority: ['red', 'yellow', 'green', 'cyan', 'gray'],
    type: ['yellow', 'green', 'red', 'cyan', 'magenta'],
    primary: 'green',
    success: 'cyan',
    error: 'red',
    warning: 'yellow',
  },
  sunset: {
    status: ['yellow', 'magenta', 'red', 'cyan'],
    priority: ['red', 'magenta', 'yellow', 'cyan', 'gray'],
    type: ['magenta', 'yellow', 'red', 'cyan', 'blue'],
    primary: 'magenta',
    success: 'cyan',
    error: 'red',
    warning: 'yellow',
  },
  monochrome: {
    status: ['white', 'gray', 'white', 'gray'],
    priority: ['white', 'white', 'gray', 'gray', 'gray'],
    type: ['white', 'white', 'white', 'gray', 'white'],
    primary: 'white',
    success: 'white',
    error: 'white',
    warning: 'white',
  },
};

function theme16(name: string, palette: Palette16, label: string): Theme {
  const [open, inProgress, blocked, closed] = palette.status;
  const [critical, high, medium, low, lowest] = palette.priority;
  const [epic, feature, bug, task, decision] = palette.type;
  return {
    name,
    label,
    depth: 'ansi16',
    colors: {
      statusOpen: open,
      statusInProgress: inProgress,
      statusBlocked: blocked,
      statusClosed: closed,
      statusDeferred: 'gray',
      statusOther: 'gray',

      priorityCritical: critical,
      priorityHigh: high,
      priorityMedium: medium,
      priorityLow: low,
      priorityLowest: lowest,

      typeEpic: epic,
      typeFeature: feature,
      typeBug: bug,
      typeTask: task,
      typeChore: 'gray',
      typeDecision: decision,
      typeOther: 'gray',

      textStrong: 'white',
      text: 'white',
      textDim: 'gray',
      textFaint: 'gray',
      rule: 'gray',

      primary: palette.primary,
      border: 'gray',
      // Painting a surface would fight the terminal's own background, which the
      // user owns at this depth; the selected row inverts instead.
      surface: '',
      surfaceSel: '',

      success: palette.success,
      error: palette.error,
      warning: palette.warning,
    },
    ink: LADDER_16,
    inkSelected: lift(LADDER_16),
    selection: { inverse: true },
  };
}

const COLOR_KEYS = [
  'statusOpen', 'statusInProgress', 'statusBlocked', 'statusClosed', 'statusDeferred',
  'statusOther', 'priorityCritical', 'priorityHigh', 'priorityMedium', 'priorityLow',
  'priorityLowest', 'typeEpic', 'typeFeature', 'typeBug', 'typeTask', 'typeChore',
  'typeDecision', 'typeOther', 'textStrong', 'text', 'textDim', 'textFaint', 'rule',
  'primary', 'border', 'surface', 'surfaceSel', 'success', 'error', 'warning',
] as const satisfies readonly (keyof ThemeColors)[];

function themeNone(name: string, label: string): Theme {
  // Ink skips the escape entirely for an empty colour, so an empty table is what
  // "no colour" means, independent of what chalk decides about the stream.
  const colors = {} as Record<keyof ThemeColors, string>;
  for (const key of COLOR_KEYS) colors[key] = '';
  return {
    name,
    label,
    depth: 'none',
    colors,
    ink: LADDER_NONE,
    inkSelected: LADDER_NONE,
    // Inert at level 0, where chalk emits no escape at all.
    selection: { inverse: true },
  };
}

const THEME_NAMES = Object.keys(PALETTES);

function build(make: (name: string, palette: Palette) => Theme): Record<string, Theme> {
  return Object.fromEntries(THEME_NAMES.map(name => [name, make(name, PALETTES[name]!)]));
}

export const themes: Record<string, Theme> = build(theme256);

export const themes16: Record<string, Theme> = Object.fromEntries(
  THEME_NAMES.map(name => [name, theme16(name, PALETTES_16[name]!, PALETTES[name]!.label)]),
);

export const themesNone: Record<string, Theme> = Object.fromEntries(
  THEME_NAMES.map(name => [name, themeNone(name, PALETTES[name]!.label)]),
);

const TABLES: Record<ColorDepth, Record<string, Theme>> = {
  ansi256: themes,
  ansi16: themes16,
  none: themesNone,
};

export const getTheme = (themeName: string, depth: ColorDepth = DEFAULT_COLOR_DEPTH): Theme => {
  const table = TABLES[depth] ?? themes;
  return table[themeName] ?? table.default!;
};

export const getThemeNames = (): string[] => THEME_NAMES;
