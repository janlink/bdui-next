import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore } from '../state/store';
import { surfaceOf } from '../session/surface';
import { VIEW_NAMES } from '../utils/constants';
import { fitToWidth } from '../utils/cells';
import { STATUS_KEYS, STATUS_LABELS } from '../utils/visibility';
import type { GlyphSet } from '../session/glyphs';
import type { Theme } from '../themes/themes';

interface FooterProps {
  currentView: 'kanban' | 'tree' | 'graph' | 'stats' | 'memories';
}

export const FOOTER_HEIGHT = 2;

/** The words the key hints carry, in display order. */
export const FOOTER_HINT_WORDS = ['search', 'filter', 'details', 'cmd', 'help'] as const;

type HintWord = (typeof FOOTER_HINT_WORDS)[number];
type StatusGlyph = 'statusOpen' | 'statusInProgress' | 'statusBlocked' | 'statusClosed' | 'statusDeferred';
type Hint = readonly [key: string, word: HintWord];

const PADDING = 1;
const GAP = 2;

const VIEWS = [
  { key: 'tree', num: '1', name: VIEW_NAMES.tree },
  { key: 'kanban', num: '2', name: VIEW_NAMES.kanban },
  { key: 'graph', num: '3', name: VIEW_NAMES.graph },
  { key: 'stats', num: '4', name: VIEW_NAMES.stats },
  { key: 'memories', num: '5', name: VIEW_NAMES.memories },
];

// The order the hints leave in when the row runs short; help goes last.
const DROP_ORDER: readonly HintWord[] = ['cmd', 'details', 'filter', 'search', 'help'];
// Search, filter and help stay as long as the tab names do; past that the
// names go first.
const HINTS_KEPT_WHILE_NAMED = 3;

const LEGEND: ReadonlyArray<[glyph: StatusGlyph, color: keyof Theme['colors'], word: string]> = [
  ['statusOpen', 'statusOpen', 'open'],
  ['statusInProgress', 'statusInProgress', 'in progress'],
  ['statusBlocked', 'statusBlocked', 'blocked'],
  ['statusClosed', 'statusClosed', 'closed'],
  ['statusDeferred', 'statusDeferred', 'deferred'],
];

function hintsOf(glyphs: GlyphSet): Hint[] {
  return [['/', 'search'], ['f', 'filter'], [glyphs.enter, 'details'], [':', 'cmd'], ['?', 'help']];
}

function tabLabel(view: (typeof VIEWS)[number], named: boolean): string {
  return named ? `${view.num} ${view.name}` : view.num;
}

// Every tab pads itself by one cell on each side; two neighbours' pads make
// the gap between them, and the chip's background covers its own pads.
function tabsWidth(named: boolean): number {
  return VIEWS.reduce((total, view) => total + stringWidth(tabLabel(view, named)) + 2, 0);
}

function hintsWidth(hints: Hint[], notice: string): number {
  return [...hints.map(([key, word]) => `${key} ${word}`), notice]
    .reduce((total, text, index) => total + stringWidth(text) + (index > 0 ? GAP : 0), 0);
}

/** Decides what the tab row shows at a given inner width. */
export function fitTabRow(inner: number, glyphs: GlyphSet, notice: string): { named: boolean; hints: Hint[] } {
  const all = hintsOf(glyphs);
  for (const named of [true, false]) {
    const tabs = tabsWidth(named);
    const floor = named ? HINTS_KEPT_WHILE_NAMED : 0;
    let hints = all;
    while (hints.length > floor && tabs + GAP + hintsWidth(hints, notice) > inner) {
      const drop = DROP_ORDER.find(word => hints.some(([, w]) => w === word));
      hints = hints.filter(([, word]) => word !== drop);
    }
    if (tabs + GAP + hintsWidth(hints, notice) <= inner) return { named, hints };
  }
  return { named: false, hints: [] };
}

function chipStyle(theme: Theme): { backgroundColor?: string; color?: string; inverse?: boolean } {
  if (theme.depth === 'none') return {};
  if (theme.colors.surface) return { backgroundColor: theme.colors.primary, color: theme.colors.surface };
  return { inverse: true, color: theme.colors.primary };
}

export function Footer({ currentView }: FooterProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const surface = useBeadsStore(state => state.surface);
  const notificationsEnabled = useBeadsStore(state => state.notificationsEnabled);
  const statusVisibility = useBeadsStore(state => state.statusVisibility);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);

  const inner = Math.max(0, terminalWidth - PADDING * 2);
  const gap = ' '.repeat(GAP);
  const noticeWord = notificationsEnabled ? 'on' : 'off';
  const { named, hints } = fitTabRow(inner, glyphs, `n ${noticeWord}`);
  const chip = chipStyle(theme);

  const hidden = STATUS_KEYS.filter(key => !statusVisibility[key]).map(key => STATUS_LABELS[key].toLowerCase());
  const note = hidden.length > 0 ? fitToWidth(`filter: ${hidden.join(', ')} hidden`, inner, glyphs.ellipsis) : '';
  const legend = [...LEGEND];
  const legendWidth = () => legend.reduce(
    (total, [glyph, , word], index) => total + stringWidth(`${glyphs[glyph]} ${word}`) + (index > 0 ? GAP : 0),
    0,
  );
  while (legend.length > 0 && legendWidth() + (note ? GAP + stringWidth(note) : 0) > inner) legend.pop();

  return (
    <Box
      flexDirection="column"
      height={FOOTER_HEIGHT}
      width={terminalWidth}
      paddingX={PADDING}
      flexShrink={0}
      overflow="hidden"
      backgroundColor={surfaceOf(theme, surface)}
    >
      <Box justifyContent="space-between">
        <Text wrap="truncate-end">
          {VIEWS.map(view => {
            const label = tabLabel(view, named);
            if (view.key !== currentView) {
              return <Text key={view.key} {...theme.ink.faint}> {label} </Text>;
            }
            return (
              <Text key={view.key} bold {...chip}>
                {theme.depth === 'none' ? `[${label}]` : ` ${label} `}
              </Text>
            );
          })}
        </Text>
        <Text wrap="truncate-end">
          {hints.map(([key, word]) => (
            <Text key={word}>
              <Text {...theme.ink.strong}>{key}</Text>
              <Text {...theme.ink.faint}> {word}</Text>
              {gap}
            </Text>
          ))}
          <Text {...theme.ink.strong}>n</Text>
          <Text {...(notificationsEnabled ? { color: theme.colors.primary } : theme.ink.faint)}> {noticeWord}</Text>
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text wrap="truncate-end">
          {legend.map(([glyph, color, word], index) => (
            <Text key={word}>
              {index > 0 ? gap : ''}
              <Text color={theme.colors[color]}>{glyphs[glyph]}</Text>
              <Text {...theme.ink.faint}> {word}</Text>
            </Text>
          ))}
        </Text>
        {note ? <Text color={theme.colors.warning} wrap="truncate-end">{note}</Text> : null}
      </Box>
    </Box>
  );
}
