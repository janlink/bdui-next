import React from 'react';
import { Box } from 'ink';
import { useBeadsStore, type LiveState } from '../state/store';
import { fitToWidth } from '../utils/cells';
import { Rule, segmentCells, words, type Segment } from './Rule';
import type { Theme } from '../themes/themes';

export interface HeaderStat {
  text: string;
  /** One rung brighter than the counts: the position in the list. */
  strong?: boolean;
}

export interface HeaderPanel {
  width: number;
  title: string;
}

interface HeaderProps {
  view: string;
  stats: HeaderStat[];
  width: number;
  /** A detail panel beside the view: the rule forks at its border and names the issue over it. */
  panel?: HeaderPanel;
}

export const HEADER_HEIGHT = 1;

// A workspace name cut shorter than this says nothing; it is dropped instead.
const MIN_WORKSPACE_CELLS = 6;
// A word set into the rule costs its cells, a pad on each side and one cell of line.
const WORD_COST = 3;

const LIVE_WORDS: Record<LiveState, string> = {
  loading: 'loading',
  live: 'live',
  stale: 'stale',
};

function liveColor(state: LiveState, theme: Theme): string {
  if (state === 'live') return theme.colors.success;
  if (state === 'stale') return theme.colors.warning;
  return theme.colors.textFaint;
}

/**
 * The rule above the view: which view, which workspace; then the view's counts
 * and whether the data is still fresh. When the row runs out of room the
 * workspace shrinks first, then goes, then the counts leave from the left; the
 * view name and the freshness stay to the last cell. Beside a detail panel the
 * rule forks at the panel's border and carries the issue id over the panel.
 */
export function Header({ view, stats, width, panel }: HeaderProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const workspaceName = useBeadsStore(state => state.workspaceName);
  const liveState = useBeadsStore(state => state.liveState);

  const listWidth = panel ? width - panel.width - 1 : width;
  const live: Segment = {
    text: `${glyphs.indicator} ${LIVE_WORDS[liveState]}`,
    style: { color: liveColor(liveState, theme) },
  };
  const rightOf = (shown: HeaderStat[]): Segment[] => words([[
    ...shown.flatMap(stat => [
      { text: stat.text, style: stat.strong ? theme.ink.dim : theme.ink.faint },
      { text: ` ${glyphs.middot} ` },
    ]),
    live,
  ]], glyphs);

  const viewWord: Segment = { text: view, style: theme.ink.strong };
  const leftMinimum = segmentCells(words([[viewWord]], glyphs));
  let shownStats = stats;
  let right = rightOf(shownStats);
  while (shownStats.length > 0 && leftMinimum + segmentCells(right) > listWidth) {
    shownStats = shownStats.slice(1);
    right = rightOf(shownStats);
  }

  const left: Segment[][] = [[viewWord]];
  if (workspaceName) {
    const room = listWidth - leftMinimum - segmentCells(right) - WORD_COST;
    if (room >= MIN_WORKSPACE_CELLS) {
      left.push([{ text: fitToWidth(workspaceName, room, glyphs.ellipsis), style: theme.ink.dim }]);
    }
  }

  return (
    <Box width={width} height={HEADER_HEIGHT} flexShrink={0} overflow="hidden">
      <Rule width={listWidth} left={words(left, glyphs)} right={right} theme={theme} glyphs={glyphs} />
      {panel && (
        <Rule
          width={panel.width + 1}
          left={[
            { text: `${glyphs.rule}${glyphs.ruleDown}` },
            ...words([[{
              text: fitToWidth(panel.title, Math.max(1, panel.width - 1 - WORD_COST - 1), glyphs.ellipsis),
              style: theme.ink.strong,
            }]], glyphs),
          ]}
          theme={theme}
          glyphs={glyphs}
        />
      )}
    </Box>
  );
}
