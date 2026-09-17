import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore, type LiveState } from '../state/store';
import { surfaceOf } from '../session/surface';
import { fitToWidth } from '../utils/cells';
import type { Theme } from '../themes/themes';

export interface HeaderStat {
  text: string;
  /** One rung brighter than the counts: the position in the list. */
  strong?: boolean;
}

interface HeaderProps {
  view: string;
  stats: HeaderStat[];
  width: number;
}

export const HEADER_HEIGHT = 1;

const PADDING = 1;
const GAP = 2;
// A workspace name cut shorter than this says nothing; it is dropped instead.
const MIN_WORKSPACE_CELLS = 6;
const BRAND = 'bdui';

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

function cellsOf(parts: string[]): number {
  return parts.reduce((total, part) => total + stringWidth(part), 0) + GAP * Math.max(0, parts.length - 1);
}

/**
 * One row above every view: who draws, which workspace, which view; then the
 * view's counts and whether the data is still fresh. When the row runs out of
 * room the workspace shrinks first, then goes, then the counts leave from the
 * left; the view name and the freshness stay to the last cell.
 */
export function Header({ view, stats, width }: HeaderProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const surface = useBeadsStore(state => state.surface);
  const workspaceName = useBeadsStore(state => state.workspaceName);
  const liveState = useBeadsStore(state => state.liveState);

  const inner = Math.max(0, width - PADDING * 2);
  const gap = ' '.repeat(GAP);
  const live = `${glyphs.indicator} ${LIVE_WORDS[liveState]}`;
  const leftMinimum = cellsOf([BRAND, view]);

  let shownStats = stats;
  let rightWidth = cellsOf([...shownStats.map(stat => stat.text), live]);
  while (shownStats.length > 0 && leftMinimum + GAP + rightWidth > inner) {
    shownStats = shownStats.slice(1);
    rightWidth = cellsOf([...shownStats.map(stat => stat.text), live]);
  }

  let workspace = '';
  if (workspaceName) {
    const room = inner - rightWidth - GAP - cellsOf([BRAND, '', glyphs.treeVertical, view]);
    workspace = room >= MIN_WORKSPACE_CELLS ? fitToWidth(workspaceName, room, glyphs.ellipsis) : '';
  }

  return (
    <Box
      width={width}
      height={HEADER_HEIGHT}
      paddingX={PADDING}
      justifyContent="space-between"
      backgroundColor={surfaceOf(theme, surface)}
      overflow="hidden"
    >
      <Text wrap="truncate-end">
        <Text bold color={theme.colors.primary}>{BRAND}</Text>
        {workspace ? (
          <>
            {gap}
            <Text {...theme.ink.dim}>{workspace}</Text>
            {gap}
            <Text {...theme.ink.rule}>{glyphs.treeVertical}</Text>
          </>
        ) : null}
        {gap}
        <Text {...theme.ink.strong}>{view}</Text>
      </Text>
      <Text wrap="truncate-end">
        {shownStats.map((stat, index) => (
          <Text key={index} {...(stat.strong ? theme.ink.dim : theme.ink.faint)}>
            {stat.text}
            {gap}
          </Text>
        ))}
        <Text color={liveColor(liveState, theme)}>{live}</Text>
      </Text>
    </Box>
  );
}
