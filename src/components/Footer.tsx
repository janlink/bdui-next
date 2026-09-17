import React from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';
import { VIEW_NAMES } from '../utils/constants';
import { fitToWidth } from '../utils/cells';
import { STATUS_KEYS, STATUS_LABELS } from '../utils/visibility';

interface FooterProps {
  currentView: 'kanban' | 'tree' | 'graph' | 'stats' | 'memories';
}

export const FOOTER_PRIMARY_SHORTCUTS = '/ search | f filter | v show | Enter/Space details | : cmd';

const FOOTER_HEIGHT = 2;
const PADDING = 1;

const VIEWS = [
  { key: 'tree', num: '1', name: VIEW_NAMES.tree },
  { key: 'kanban', num: '2', name: VIEW_NAMES.kanban },
  { key: 'graph', num: '3', name: VIEW_NAMES.graph },
  { key: 'stats', num: '4', name: VIEW_NAMES.stats },
  { key: 'memories', num: '5', name: VIEW_NAMES.memories },
];

// Below this the tab names collide with the help and notification hints, and
// flexbox drops them mid-word rather than as whole labels.
const NAMED_TABS_MIN_WIDTH = 92;

export function Footer({ currentView }: FooterProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const notificationsEnabled = useBeadsStore(state => state.notificationsEnabled);
  const statusVisibility = useBeadsStore(state => state.statusVisibility);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  const showNames = terminalWidth >= NAMED_TABS_MIN_WIDTH;
  const hidden = STATUS_KEYS.filter(key => !statusVisibility[key]).map(key => STATUS_LABELS[key]);
  const fold = currentView === 'tree' ? ` | ${glyphs.arrowLeft}/${glyphs.arrowRight} fold` : '';
  // Ink's own truncation appends its own ellipsis, which is not in the tier.
  const shortcuts = fitToWidth(
    `${FOOTER_PRIMARY_SHORTCUTS}${fold}`,
    terminalWidth - PADDING * 2,
    glyphs.ellipsis,
  );

  return (
    <Box paddingX={PADDING} flexDirection="column" height={FOOTER_HEIGHT} flexShrink={0} overflow="hidden">
      <Text {...theme.ink.faint} wrap="truncate-end">{shortcuts}</Text>
      <Box justifyContent="space-between" width="100%">
        <Box gap={1}>
          {VIEWS.map(v =>
            v.key === currentView ? (
              <Text key={v.key} bold color={theme.colors.primary}>[{v.num}]{showNames ? ` ${v.name}` : ''}</Text>
            ) : (
              <Text key={v.key} {...theme.ink.faint}>{v.num}{showNames ? ` ${v.name}` : ''}</Text>
            ),
          )}
        </Box>
        <Box gap={2}>
          {hidden.length > 0 ? (
            <Text color={theme.colors.warning}>hidden: {hidden.join(', ')}</Text>
          ) : null}
          <Text {...theme.ink.faint}>? help | q quit</Text>
          {notificationsEnabled ? (
            <Text color={theme.colors.primary}>n:ON</Text>
          ) : (
            <Text {...theme.ink.faint}>n:off</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
