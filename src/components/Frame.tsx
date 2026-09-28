import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore } from '../state/store';
import { fitToWidth } from '../utils/cells';

/** Rows a frame adds around its body: the two border rows and the title row. */
export const FRAME_CHROME = 2 + 1;

/** Columns a frame takes from its width: the border and one cell of padding on each side. */
export const FRAME_INSET = 2 + 2;
const ASIDE_GAP = 2;
// An aside cut shorter than this says nothing; it leaves instead.
const MIN_ASIDE_CELLS = 6;

export interface TitleRow {
  aside: string;
  hints: string;
}

/**
 * What the title row keeps at a given width: the title always; the hints leave
 * from the end one by one until the aside fits, and only then does the aside
 * shorten, then leave.
 */
export function fitTitleRow(
  inner: number,
  title: string,
  aside: string,
  hints: readonly string[],
  separator: string,
  ellipsis: string,
): TitleRow {
  const joined = (kept: readonly string[]) => kept.join(` ${separator} `);
  const room = (kept: readonly string[]) => {
    const hintCells = kept.length > 0 ? ASIDE_GAP + stringWidth(joined(kept)) : 0;
    return inner - stringWidth(title) - hintCells;
  };
  const asideCost = aside ? ASIDE_GAP + stringWidth(aside) : 0;

  let kept = [...hints];
  while (kept.length > 0 && room(kept) < asideCost) kept = kept.slice(0, -1);
  const left = room(kept) - ASIDE_GAP;
  const fitted = !aside || left < MIN_ASIDE_CELLS ? '' : fitToWidth(aside, left, ellipsis);
  return { aside: fitted, hints: joined(kept) };
}

interface FrameProps {
  title: string;
  /** Short words beside the title: a count, a state, what is active. */
  aside?: string;
  /** Key hints, right-aligned in the title row and joined with the tier's middot. */
  hints?: readonly string[];
  width: number;
  /** The border and title color; a warning frame asks before something irreversible. */
  tone?: 'primary' | 'warning';
  /** Floating frames paint the surface over the view behind them. */
  floating?: boolean;
  children?: React.ReactNode;
}

/**
 * The one frame every dialog, panel, and form draws in: a rounded border, the
 * title and its aside on the left of the first row, the key hints on its right.
 */
export function Frame({ title, aside = '', hints = [], width, tone = 'primary', floating = false, children }: FrameProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const color = tone === 'warning' ? theme.colors.warning : theme.colors.primary;
  const row = fitTitleRow(Math.max(0, width - FRAME_INSET), title, aside, hints, glyphs.middot, glyphs.ellipsis);

  return (
    <Box
      flexDirection="column"
      width={width}
      flexShrink={0}
      borderStyle={glyphs.border('round')}
      borderColor={color}
      paddingX={1}
      backgroundColor={floating ? theme.colors.surface : undefined}
    >
      <Box>
        <Text bold color={color}>{title}</Text>
        {row.aside && <Text {...theme.ink.dim}>{' '.repeat(ASIDE_GAP)}{row.aside}</Text>}
        <Box flexGrow={1} />
        {row.hints && <Text {...theme.ink.faint}>{row.hints}</Text>}
      </Box>
      {children}
    </Box>
  );
}

/** Centers a floating frame over the whole terminal. */
export function Floating({ children }: { children: React.ReactNode }) {
  return (
    <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
      {children}
    </Box>
  );
}

/** A text cursor that holds in every glyph tier. */
export function Cursor() {
  return <Text inverse> </Text>;
}
