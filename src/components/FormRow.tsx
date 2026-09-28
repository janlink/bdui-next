import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore } from '../state/store';
import type { GlyphSet } from '../session/glyphs';
import { fitToWidth } from '../utils/cells';
import { Cursor } from './Frame';

export const FORM_LABEL_WIDTH = 16;


/** The key hints both issue forms carry in their title row. */
export function formHints(glyphs: GlyphSet): string[] {
  return ['Tab/Shift+Tab field', `${glyphs.scrollUp}${glyphs.scrollDown} change`, 'Enter submit', 'Esc cancel'];
}

// The selection arrow and its space, in front of the label.
const MARKER_CELLS = 2;
const COUNTER_GAP = 2;

/** The end of `text` that fits `width` cells, led by the ellipsis when cut. */
export function tailToWidth(text: string, width: number, ellipsis: string): string {
  if (stringWidth(text) <= width) return text;
  const room = Math.max(0, width - stringWidth(ellipsis));
  let tail = '';
  for (const char of [...text].reverse()) {
    if (stringWidth(char + tail) > room) break;
    tail = char + tail;
  }
  return ellipsis + tail;
}

interface FormRowProps {
  label: string;
  value: string;
  /** Shown faint in place of an empty value. */
  placeholder?: string;
  /** Text takes typing at a cursor; a choice cycles with the arrows; read-only does neither. */
  kind?: 'text' | 'choice' | 'readonly';
  active: boolean;
  required?: boolean;
  /** The value differs from the one the form opened with. */
  changed?: boolean;
  invalid?: boolean;
  /** A right-aligned note such as a character count. */
  counter?: string;
  counterWarning?: boolean;
  /** The row's full width, inside the frame. */
  width: number;
}

/**
 * One form field on one row: a marker and the label in a fixed column, then
 * the value. The active row carries the marker and the accent color; a text
 * value being edited shows its end and the cursor, any other its start.
 */
export function FormRow({
  label,
  value,
  placeholder = '',
  kind = 'text',
  active,
  required = false,
  changed = false,
  invalid = false,
  counter,
  counterWarning = false,
  width,
}: FormRowProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  const accent = invalid ? theme.colors.error : theme.colors.primary;
  const labelColor = active ? accent : kind === 'readonly' ? theme.colors.textFaint : theme.colors.text;
  const labelText = `${label}${required ? ' *' : ''}`;
  const changedMark = changed ? ` ${glyphs.bullet}` : '';
  const counterCells = counter ? COUNTER_GAP + stringWidth(counter) : 0;
  const choiceHint = kind === 'choice' && active ? `  ${glyphs.scrollUp}${glyphs.scrollDown}` : '';
  const cursorCells = kind === 'text' && active ? 1 : 0;
  const room = Math.max(1, width - FORM_LABEL_WIDTH - counterCells - stringWidth(choiceHint) - cursorCells);

  const shown = value
    ? (kind === 'text' && active ? tailToWidth(value, room, glyphs.ellipsis) : fitToWidth(value, room, glyphs.ellipsis))
    : '';

  return (
    <Box width={width}>
      <Box width={FORM_LABEL_WIDTH} flexShrink={0}>
        <Text color={theme.colors.primary}>{active ? `${glyphs.selectArrow} ` : ' '.repeat(MARKER_CELLS)}</Text>
        <Text color={labelColor} bold={active}>
          {fitToWidth(labelText, FORM_LABEL_WIDTH - MARKER_CELLS - stringWidth(changedMark) - 1, glyphs.ellipsis)}
        </Text>
        {changed && <Text color={theme.colors.warning}>{changedMark}</Text>}
      </Box>
      <Box flexGrow={1}>
        {shown
          ? <Text color={kind === 'readonly' ? theme.colors.textDim : theme.colors.text}>{shown}</Text>
          : !active && placeholder ? <Text {...theme.ink.faint}>{fitToWidth(placeholder, room, glyphs.ellipsis)}</Text> : null}
        {kind === 'text' && active && <Cursor />}
        {kind === 'text' && active && !value && placeholder && (
          <Text {...theme.ink.faint}>{fitToWidth(` ${placeholder}`, Math.max(1, room - 1), glyphs.ellipsis)}</Text>
        )}
        {choiceHint && <Text {...theme.ink.faint}>{choiceHint}</Text>}
      </Box>
      {counter && (
        <Text color={counterWarning ? theme.colors.warning : theme.colors.textFaint}>{' '.repeat(COUNTER_GAP)}{counter}</Text>
      )}
    </Box>
  );
}
