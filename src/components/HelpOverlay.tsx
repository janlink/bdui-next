import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore } from '../state/store';
import type { GlyphSet } from '../session/glyphs';
import { fitToWidth } from '../utils/cells';
import { Frame, FRAME_CHROME, FRAME_INSET } from './Frame';
import { FOOTER_HEIGHT } from './Footer';

/** A key and what it does; a row without a key is a note under its section. */
type HelpRow = readonly [key: string, action: string];

interface HelpSection {
  title: string;
  rows: readonly HelpRow[];
}

export function helpSections(glyphs: GlyphSet): HelpSection[] {
  return [
    {
      title: 'Navigation',
      rows: [
        ['left/right or h/l', 'Move between columns'],
        ['up/down or k/j', 'Move up/down in column'],
        ['0', 'Jump to first issue'],
        ['$ or G', 'Jump to last issue'],
      ],
    },
    {
      title: 'Views',
      rows: [
        ['1', 'Tree view (hierarchical)'],
        ['2', 'Kanban board view'],
        ['3', 'Statistics & analytics dashboard'],
        ['4', 'Memories (bd remember; d delete, r refresh)'],
      ],
    },
    {
      title: 'Search & Filter',
      rows: [
        ['/', 'Open search'],
        ['f', 'Open filter panel'],
        ['v', 'Choose which statuses are shown'],
        ['c', 'Clear all filters and search'],
        ['', 'Closed is hidden by default; children of a shown parent stay visible'],
      ],
    },
    {
      title: 'Actions',
      rows: [
        ['N', 'Create new issue (Shift+N)'],
        ['e', 'Edit selected issue'],
        ['x', 'Export/copy selected issue'],
        ['z', 'Collapse/expand the whole tree'],
        ['Enter or Space', 'Toggle detail panel'],
        ['PgUp/PgDn', 'Page the description (the arrows too when the panel fills the view)'],
        ['m', 'Show the description as rendered Markdown or as source'],
        ['r', 'Refresh data'],
        ['u', 'Undo (view history)'],
      ],
    },
    {
      title: 'Command bar',
      rows: [
        [': or g', 'Open the command bar'],
        [':5', 'Jump to page 5'],
        [':issue-id', 'Jump to issue by ID'],
        [':s o/i/b/c', 'Set status'],
        [':p 0-4', `Set priority (P0 Critical ${glyphs.arrowRight} P4 Backlog)`],
        [':kanban :tree', 'Switch view (also :stats, :mem)'],
        [':theme name', 'Change theme'],
        [':new :edit :q', 'Create, edit, quit'],
      ],
    },
    {
      title: 'Forms',
      rows: [
        ['Tab/Shift+Tab', 'Navigate between fields'],
        ['up/down', 'Change priority/status/type'],
        ['Enter', 'Submit (with confirmation)'],
        ['Esc', 'Cancel and return'],
      ],
    },
    {
      title: 'Other',
      rows: [
        ['t', 'Change theme / color scheme'],
        ['n', 'Toggle notifications when an issue closes or becomes blocked'],
        ['?', 'Toggle this help'],
        ['q or Ctrl+C', 'Quit'],
      ],
    },
  ];
}

type HelpLine =
  | { kind: 'heading'; text: string }
  | { kind: 'row'; key: string; action: string }
  | { kind: 'note'; text: string }
  | { kind: 'blank' };

export function helpLines(sections: readonly HelpSection[]): HelpLine[] {
  return sections.flatMap((section, index) => [
    ...(index > 0 ? [{ kind: 'blank' } as const] : []),
    { kind: 'heading', text: section.title } as const,
    ...section.rows.map(([key, action]): HelpLine => (
      key ? { kind: 'row', key, action } : { kind: 'note', text: action }
    )),
  ]);
}

// Rows the overlay keeps clear above itself; below, it leaves the footer in sight.
const MARGIN_ROWS = 1;
const MAX_WIDTH = 96;
const KEY_GAP = 2;

/**
 * The keyboard reference. It owns the keyboard while open: the arrows, j/k,
 * and PgUp/PgDn scroll it, and Esc, q, or ? close it. A terminal too short for
 * the whole reference shows a window of it and counts the rows around it.
 */
export function HelpOverlay() {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  const terminalHeight = useBeadsStore(state => state.terminalHeight);
  const toggleHelp = useBeadsStore(state => state.toggleHelp);

  const lines = helpLines(helpSections(glyphs));
  const keyWidth = Math.max(...lines.map(line => (line.kind === 'row' ? stringWidth(line.key) : 0)));
  const width = Math.min(MAX_WIDTH, terminalWidth - 2);
  const window = Math.max(1, terminalHeight - MARGIN_ROWS - FOOTER_HEIGHT - FRAME_CHROME);
  const maxOffset = Math.max(0, lines.length - window);
  const [offset, setOffset] = useState(0);
  const top = Math.min(offset, maxOffset);
  const scroll = (delta: number) => setOffset(Math.max(0, Math.min(maxOffset, top + delta)));

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === '?') {
      toggleHelp();
      return;
    }
    if (key.downArrow || input === 'j') scroll(1);
    else if (key.upArrow || input === 'k') scroll(-1);
    else if (key.pageDown || input === ' ') scroll(window - 1);
    else if (key.pageUp) scroll(-(window - 1));
  });

  const shown = lines.slice(top, top + window);
  const inner = width - FRAME_INSET;
  const actionWidth = Math.max(1, inner - keyWidth - KEY_GAP);
  const aside = maxOffset > 0 ? `${top + 1}-${top + shown.length} of ${lines.length}` : '';
  const hints = [
    ...(maxOffset > 0 ? [`${glyphs.scrollUp}${glyphs.scrollDown} PgUp/PgDn scroll`] : []),
    'Esc close',
  ];

  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="flex-start" paddingTop={MARGIN_ROWS}>
      <Frame title="Keyboard shortcuts" aside={aside} hints={hints} width={width} floating>
        {shown.map((line, index) => {
          if (line.kind === 'blank') return <Text key={index}> </Text>;
          if (line.kind === 'heading') return <Text key={index} {...theme.ink.strong} bold>{line.text}</Text>;
          if (line.kind === 'note') return <Text key={index} {...theme.ink.faint}>{fitToWidth(line.text, inner, glyphs.ellipsis)}</Text>;
          return (
            <Box key={index}>
              <Box width={keyWidth + KEY_GAP} flexShrink={0}>
                <Text color={theme.colors.primary}>{line.key}</Text>
              </Box>
              <Text {...theme.ink.dim}>{fitToWidth(line.action, actionWidth, glyphs.ellipsis)}</Text>
            </Box>
          );
        })}
      </Frame>
    </Box>
  );
}
