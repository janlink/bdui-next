import stringWidth from 'string-width';

// The characters bdui draws with, as three complete sets. Font coverage is not
// observable from inside a terminal — no escape sequence asks for it, and over
// SSH the font lives on the other machine — so the viewer picks a tier and bdui
// never infers one.
//
//   fancy  every character carries in the common GUI terminals
//   safe   the CP437 subset that terminal fonts ship for compatibility
//   ascii  for terminals without UTF-8, where box drawing breaks too

export type GlyphTier = 'fancy' | 'safe' | 'ascii';

export const GLYPH_TIERS: readonly GlyphTier[] = ['fancy', 'safe', 'ascii'] as const;

export const DEFAULT_GLYPH_TIER: GlyphTier = 'fancy';

/** The border styles bdui asks for, before the tier maps them onto Ink's. */
export type BorderStyleName = 'single' | 'double' | 'round' | 'classic';

export interface GlyphSet {
  tier: GlyphTier;

  statusOpen: string;
  statusInProgress: string;
  statusBlocked: string;
  statusClosed: string;
  statusDeferred: string;
  statusOther: string;
  gutter: string;
  barDone: string;
  barEmpty: string;
  caretCollapsed: string;
  caretExpanded: string;
  treeBranch: string;
  treeLast: string;
  treeVertical: string;
  treeDash: string;
  ellipsis: string;
  scrollUp: string;
  scrollDown: string;
  checkboxOn: string;
  checkboxOff: string;
  selectArrow: string;
  prompt: string;
  graphBlocked: string;
  graphEdge: string;
  arrowRight: string;
  arrowLeft: string;
  themeSwatch: string;
  bullet: string;
  middot: string;

  // Ink draws its own frames from cli-boxes, so the tier has to map those too.
  border: (style: BorderStyleName) => BorderStyleName;
}

const FANCY: GlyphSet = {
  tier: 'fancy',
  statusOpen: '○',
  statusInProgress: '◐',
  statusBlocked: '●',
  statusClosed: '✓',
  statusDeferred: '◊',
  statusOther: '∙',
  gutter: '▋',
  barDone: '█',
  barEmpty: '▒',
  caretCollapsed: '▸',
  caretExpanded: '▾',
  treeBranch: '├',
  treeLast: '└',
  treeVertical: '│',
  treeDash: '─',
  ellipsis: '…',
  scrollUp: '↑',
  scrollDown: '↓',
  checkboxOn: '☑',
  checkboxOff: '☐',
  selectArrow: '▶',
  prompt: '❯',
  graphBlocked: '⊘',
  graphEdge: '↳',
  arrowRight: '→',
  arrowLeft: '←',
  themeSwatch: '■',
  bullet: '•',
  middot: '·',
  border: style => style,
};

const SAFE: GlyphSet = {
  tier: 'safe',
  statusOpen: '░',
  statusInProgress: '▒',
  statusBlocked: '▓',
  statusClosed: '√',
  statusDeferred: '◊',
  statusOther: '∙',
  gutter: '█',
  barDone: '█',
  barEmpty: '▒',
  caretCollapsed: '>',
  caretExpanded: 'v',
  treeBranch: '├',
  treeLast: '└',
  treeVertical: '│',
  treeDash: '─',
  ellipsis: '…',
  scrollUp: '^',
  scrollDown: 'v',
  checkboxOn: '[x]',
  checkboxOff: '[ ]',
  selectArrow: '>',
  prompt: '>',
  graphBlocked: 'x',
  graphEdge: '└─',
  arrowRight: '->',
  arrowLeft: '<-',
  themeSwatch: '█',
  bullet: '•',
  middot: '·',
  // Rounded corners are not in CP437; single and double are.
  border: style => (style === 'round' ? 'single' : style),
};

const ASCII: GlyphSet = {
  tier: 'ascii',
  statusOpen: 'o',
  statusInProgress: '*',
  statusBlocked: '!',
  statusClosed: 'x',
  statusDeferred: '~',
  statusOther: '?',
  gutter: '|',
  barDone: '#',
  barEmpty: '-',
  caretCollapsed: '>',
  caretExpanded: 'v',
  treeBranch: '+',
  treeLast: '+',
  treeVertical: '|',
  treeDash: '-',
  ellipsis: '~',
  scrollUp: '^',
  scrollDown: 'v',
  checkboxOn: '[x]',
  checkboxOff: '[ ]',
  selectArrow: '>',
  prompt: '>',
  graphBlocked: 'x',
  graphEdge: '-',
  arrowRight: '->',
  arrowLeft: '<-',
  themeSwatch: '#',
  bullet: '*',
  middot: '.',
  border: () => 'classic',
};

export const glyphSets: Record<GlyphTier, GlyphSet> = {
  fancy: FANCY,
  safe: SAFE,
  ascii: ASCII,
};

export function getGlyphs(tier: GlyphTier): GlyphSet {
  return glyphSets[tier] ?? glyphSets[DEFAULT_GLYPH_TIER];
}

export function statusGlyphsOf(glyphs: GlyphSet): string[] {
  return [
    glyphs.statusOpen,
    glyphs.statusInProgress,
    glyphs.statusBlocked,
    glyphs.statusClosed,
    glyphs.statusDeferred,
    glyphs.statusOther,
  ];
}

/**
 * Cells a set of interchangeable characters needs, measured under the ambiguous
 * width currently in force. The status glyphs are not all of one East Asian
 * Width class, so on an ambiguous-wide terminal some take two cells and some
 * one; taking the maximum and padding each glyph to it keeps the columns to the
 * right of them at a fixed index.
 */
export function cellWidthOf(candidates: string[]): number {
  return candidates.reduce((widest, glyph) => Math.max(widest, stringWidth(glyph)), 1);
}

function isGlyphTier(value: string): value is GlyphTier {
  return (GLYPH_TIERS as readonly string[]).includes(value);
}

/**
 * BDUI_GLYPHS picks the tier. There is no auto: font coverage cannot be probed,
 * so an unset or unrecognised value keeps the optimistic default and
 * `bdui --glyph-check` is how a viewer finds out what their font carries.
 */
export function resolveGlyphTier(
  env: Record<string, string | undefined> = process.env,
): GlyphTier {
  const requested = env.BDUI_GLYPHS?.trim().toLowerCase();
  if (requested && isGlyphTier(requested)) return requested;
  return DEFAULT_GLYPH_TIER;
}
