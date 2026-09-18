import packageJson from '../package.json';
import { GLYPH_TIERS, getGlyphs, type GlyphSet } from './session/glyphs';

export const HELP_TEXT = `bdui - terminal UI for the Beads issue tracker

Usage:
  bdui
  bdui --help
  bdui --version
  bdui --glyph-check

Run bdui inside a project with an active Beads workspace. bdui discovers the
workspace through "bd where" and reads and writes issues through the bd CLI.

Environment:
  BDUI_GLYPHS     fancy | safe | ascii     which characters to draw with
  BDUI_COLOR      auto | 256 | 16 | none   how many colours to spend
  BDUI_AMBIGUOUS  auto | narrow | wide     width of East Asian Ambiguous characters
  NO_COLOR        set to any value         same as BDUI_COLOR=none`;

const SAMPLE_SLOTS: (keyof GlyphSet)[] = [
  'statusOpen', 'statusInProgress', 'statusBlocked', 'statusClosed', 'statusDeferred',
  'statusOther', 'gutter', 'barDone', 'barEmpty', 'caretCollapsed', 'caretExpanded',
  'treeBranch', 'treeLast', 'treeVertical', 'treeDash', 'ellipsis', 'scrollUp',
  'scrollDown', 'checkboxOn', 'checkboxOff', 'selectArrow', 'prompt',
  'arrowRight', 'arrowLeft', 'themeSwatch', 'bullet', 'middot', 'indicator',
  'rule', 'ruleDown', 'ruleUp',
];

/**
 * Font coverage cannot be probed, so the viewer decides by looking. A slot that
 * shows a box, a blank or a character noticeably wider than its neighbours is
 * missing from the font, and the next tier down is the one to use.
 */
export function glyphCheckText(): string {
  const lines = ['Pick the last tier whose characters all render as single, distinct shapes.', ''];
  for (const tier of GLYPH_TIERS) {
    const glyphs = getGlyphs(tier);
    lines.push(`${tier.padEnd(6)} ${SAMPLE_SLOTS.map(slot => glyphs[slot]).join(' ')}`);
  }
  lines.push('', 'Then run:  BDUI_GLYPHS=<tier> bdui');
  return lines.join('\n');
}

export function handleCliArgs(
  args: readonly string[],
  write: (message: string) => void = console.log,
): boolean {
  if (args.includes('--help') || args.includes('-h')) {
    write(HELP_TEXT);
    return true;
  }

  if (args.includes('--version') || args.includes('-v')) {
    write(`bdui ${packageJson.version}`);
    return true;
  }

  if (args.includes('--glyph-check')) {
    write(glyphCheckText());
    return true;
  }

  return false;
}
