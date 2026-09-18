import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore } from '../state/store';
import { VIEW_NAMES } from '../utils/constants';
import { fitToWidth } from '../utils/cells';
import { STATUS_KEYS, STATUS_LABELS } from '../utils/visibility';
import { Rule, segmentCells, words, type Segment } from './Rule';
import type { GlyphSet } from '../session/glyphs';
import type { Theme } from '../themes/themes';

type ViewKey = 'kanban' | 'tree' | 'stats' | 'memories';

export interface FooterTrailer {
  above: number;
  below: number;
}

interface FooterProps {
  currentView: ViewKey;
  /** Rows the view scrolled past, above and below its window. */
  trailer?: FooterTrailer;
  /** A detail panel beside the view: the rule closes its border and carries its keys. */
  panel?: { width: number; actions?: readonly [key: string, label: string][] };
}

export const FOOTER_HEIGHT = 2;

/** Below this many columns the hints row belongs to the hints alone. */
export const LEGEND_MIN_WIDTH = 120;

/** The words the key hints carry, in display order. */
export const FOOTER_HINT_WORDS = ['search', 'filter', 'details', 'move', 'delete', 'refresh', 'cmd', 'help'] as const;

type HintWord = (typeof FOOTER_HINT_WORDS)[number];
type StatusGlyph = 'statusOpen' | 'statusInProgress' | 'statusBlocked' | 'statusClosed' | 'statusDeferred';
type Hint = readonly [key: string, word: HintWord];

const PADDING = 1;
const GAP = 2;
// A word set into the rule costs its cells, a pad on each side and one cell of line.
const WORD_COST = 3;
// A filter note cut shorter than this says nothing; it leaves instead.
const MIN_NOTE_CELLS = 12;

const VIEWS = [
  { key: 'tree', num: '1', name: VIEW_NAMES.tree },
  { key: 'kanban', num: '2', name: VIEW_NAMES.kanban },
  { key: 'stats', num: '3', name: VIEW_NAMES.stats },
  { key: 'memories', num: '4', name: VIEW_NAMES.memories },
];

// The order the hints leave in when the row runs short; help goes last.
const DROP_ORDER: readonly HintWord[] = ['cmd', 'details', 'refresh', 'delete', 'filter', 'search', 'move', 'help'];

const LEGEND: ReadonlyArray<[glyph: StatusGlyph, color: keyof Theme['colors'], word: string]> = [
  ['statusOpen', 'statusOpen', 'open'],
  ['statusInProgress', 'statusInProgress', 'in progress'],
  ['statusBlocked', 'statusBlocked', 'blocked'],
  ['statusClosed', 'statusClosed', 'closed'],
  ['statusDeferred', 'statusDeferred', 'deferred'],
];

function hintsOf(currentView: ViewKey, glyphs: GlyphSet): Hint[] {
  if (currentView === 'memories') {
    return [['/', 'search'], ['f', 'filter'], ['j/k', 'move'], ['d', 'delete'], ['r', 'refresh'], [':', 'cmd'], ['?', 'help']];
  }
  return [['/', 'search'], ['f', 'filter'], [glyphs.enter, 'details'], [':', 'cmd'], ['?', 'help']];
}

function tabSegments(named: boolean, currentView: ViewKey, theme: Theme, glyphs: GlyphSet): Segment[] {
  return words(VIEWS.map(view => {
    const label = named ? `${view.num} ${view.name}` : view.num;
    if (view.key !== currentView) return [{ text: label, style: theme.ink.faint }];
    if (theme.depth === 'none') return [{ text: `[${label}]` }];
    return [{ text: label, style: { color: theme.colors.primary, bold: true } }];
  }), glyphs);
}

function cellsOf(texts: readonly string[]): number {
  return texts.reduce((total, text, index) => total + stringWidth(text) + (index > 0 ? GAP : 0), 0);
}

/** Cells `words()` spends on these, or none when there are none. */
function wordCells(texts: readonly string[]): number {
  const kept = texts.filter(Boolean);
  return kept.length === 0 ? 0 : 1 + kept.reduce((total, text) => total + stringWidth(text) + WORD_COST, 0);
}

/**
 * What the rule shows at a given width: the tab names go first, then the
 * filter note shortens and leaves, and the trailer is the last to go.
 */
export function fitFooterRule(
  inner: number,
  tabCells: (named: boolean) => number,
  note: string,
  trailer: string,
  ellipsis: string,
): { named: boolean; note: string; trailer: string } {
  for (const named of [true, false]) {
    if (tabCells(named) + wordCells([note, trailer]) <= inner) return { named, note, trailer };
  }
  const room = inner - tabCells(false) - wordCells([trailer]) - (trailer ? WORD_COST : WORD_COST + 1);
  if (note && room >= MIN_NOTE_CELLS) return { named: false, note: fitToWidth(note, room, ellipsis), trailer };
  if (tabCells(false) + wordCells([trailer]) <= inner) return { named: false, note: '', trailer };
  return { named: false, note: '', trailer: '' };
}

/**
 * What the hints row shows: every hint with the legend where the terminal is
 * wide enough, otherwise the hints alone, leaving one by one until they fit.
 */
export function fitHintsRow(
  inner: number,
  hints: Hint[],
  legend: readonly string[],
  notice: string,
  terminalWidth: number,
): { hints: Hint[]; legend: boolean } {
  const hintTexts = (kept: Hint[]) => kept.map(([key, word]) => `${key} ${word}`);
  if (terminalWidth >= LEGEND_MIN_WIDTH && cellsOf(hintTexts(hints)) + GAP + cellsOf([...legend, notice]) <= inner) {
    return { hints, legend: true };
  }
  let kept = hints;
  while (kept.length > 0 && cellsOf(hintTexts(kept)) + GAP + stringWidth(notice) > inner) {
    const drop = DROP_ORDER.find(word => kept.some(([, w]) => w === word));
    kept = kept.filter(([, word]) => word !== drop);
  }
  return { hints: kept, legend: false };
}

function trailerText(trailer: FooterTrailer | undefined, glyphs: GlyphSet): string {
  if (!trailer) return '';
  const parts: string[] = [];
  if (trailer.above > 0) parts.push(`${glyphs.scrollUp} ${trailer.above}`);
  if (trailer.below > 0) parts.push(`${glyphs.scrollDown} ${trailer.below} more`);
  return parts.join('  ');
}

/**
 * Two rows under every view. The rule carries the view tabs, the filter note
 * and the scroll trailer, and beside a detail panel closes the panel's border
 * and names its keys. The row beneath holds the key hints, the status legend on
 * a wide terminal, and the notification switch.
 */
export function Footer({ currentView, trailer, panel }: FooterProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const notificationsEnabled = useBeadsStore(state => state.notificationsEnabled);
  const statusVisibility = useBeadsStore(state => state.statusVisibility);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);

  const listWidth = panel ? terminalWidth - panel.width - 1 : terminalWidth;
  const hidden = STATUS_KEYS.filter(key => !statusVisibility[key]).map(key => STATUS_LABELS[key].toLowerCase());
  const fit = fitFooterRule(
    listWidth,
    named => segmentCells(tabSegments(named, currentView, theme, glyphs)),
    hidden.length > 0 ? `filter: ${hidden.join(', ')} hidden` : '',
    trailerText(trailer, glyphs),
    glyphs.ellipsis,
  );
  const right: Segment[][] = [];
  if (fit.note) right.push([{ text: fit.note, style: { color: theme.colors.warning } }]);
  if (fit.trailer) right.push([{ text: fit.trailer, style: theme.ink.dim }]);

  const inner = Math.max(0, terminalWidth - PADDING * 2);
  const gap = ' '.repeat(GAP);
  const noticeWord = notificationsEnabled ? 'on' : 'off';
  const row = fitHintsRow(
    inner,
    hintsOf(currentView, glyphs),
    LEGEND.map(([glyph, , word]) => `${glyphs[glyph]} ${word}`),
    `n ${noticeWord}`,
    terminalWidth,
  );

  return (
    <Box flexDirection="column" height={FOOTER_HEIGHT} width={terminalWidth} flexShrink={0} overflow="hidden">
      <Box>
        <Rule
          width={listWidth}
          left={tabSegments(fit.named, currentView, theme, glyphs)}
          right={right.length > 0 ? words(right, glyphs) : []}
          theme={theme}
          glyphs={glyphs}
        />
        {panel && (
          <Rule
            width={panel.width + 1}
            left={[
              { text: `${glyphs.rule}${glyphs.ruleUp}` },
              ...words([(
                panel.actions ?? [['e', 'edit'], ['x', 'export'], ['esc', 'close']]
              ).flatMap(([key, label], index, actions) => [
                { text: key, style: theme.ink.strong },
                { text: ` ${label}${index < actions.length - 1 ? '  ' : ''}`, style: theme.ink.faint },
              ])], glyphs),
            ]}
            theme={theme}
            glyphs={glyphs}
          />
        )}
      </Box>
      <Box paddingX={PADDING} justifyContent="space-between">
        <Text wrap="truncate-end">
          {row.hints.map(([key, word], index) => (
            <Text key={word}>
              {index > 0 ? gap : ''}
              <Text {...theme.ink.strong}>{key}</Text>
              <Text {...theme.ink.faint}> {word}</Text>
            </Text>
          ))}
        </Text>
        <Text wrap="truncate-end">
          {row.legend && LEGEND.map(([glyph, color, word]) => (
            <Text key={word}>
              <Text color={theme.colors[color]}>{glyphs[glyph]}</Text>
              <Text {...theme.ink.faint}> {word}</Text>
              {gap}
            </Text>
          ))}
          <Text {...theme.ink.strong}>n</Text>
          <Text {...(notificationsEnabled ? { color: theme.colors.primary } : theme.ink.faint)}> {noticeWord}</Text>
        </Text>
      </Box>
    </Box>
  );
}
