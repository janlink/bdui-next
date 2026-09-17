import React from 'react';
import { Text } from 'ink';
import stringWidth from 'string-width';
import type { GlyphSet } from '../session/glyphs';
import type { Theme } from '../themes/themes';

/** A run of text in a rule; a run without a style takes the rule's own ink. */
export interface Segment {
  text: string;
  style?: React.ComponentProps<typeof Text>;
}

export function segmentCells(segments: readonly Segment[]): number {
  return segments.reduce((total, segment) => total + stringWidth(segment.text), 0);
}

/**
 * Words set into a rule, one cell of line between them and around them:
 * `─ first ─ second ─`. Each entry is one word, possibly in several styles.
 */
export function words(entries: readonly (readonly Segment[])[], glyphs: GlyphSet): Segment[] {
  const out: Segment[] = [{ text: glyphs.rule }];
  for (const entry of entries) out.push({ text: ' ' }, ...entry, { text: ` ${glyphs.rule}` });
  return out;
}

interface RuleProps {
  width: number;
  left?: readonly Segment[];
  right?: readonly Segment[];
  theme: Theme;
  glyphs: GlyphSet;
}

/**
 * One rule across a row: the words on the left, the line, the words on the
 * right. Callers fit their words to the width; the rule fills what they leave.
 */
export function Rule({ width, left = [], right = [], theme, glyphs }: RuleProps) {
  const fill = Math.max(0, width - segmentCells(left) - segmentCells(right));
  // Box drawing is East Asian Ambiguous, so on an ambiguous-wide terminal each
  // rule character takes two cells and an odd remainder is left blank.
  const unit = Math.max(1, stringWidth(glyphs.rule));
  const count = Math.floor(fill / unit);
  const run = (segments: readonly Segment[], side: string) => segments.map((segment, index) => (
    <Text key={`${side}${index}`} {...(segment.style ?? theme.ink.rule)}>{segment.text}</Text>
  ));
  return (
    <Text wrap="truncate-end">
      {run(left, 'l')}
      <Text {...theme.ink.rule}>{glyphs.rule.repeat(count)}{' '.repeat(fill - count * unit)}</Text>
      {run(right, 'r')}
    </Text>
  );
}
