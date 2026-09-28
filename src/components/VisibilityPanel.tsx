import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { Frame } from './Frame';

const PANEL_WIDTH = 56;
import { getStatusColor } from '../utils/constants';
import { STATUS_KEYS, STATUS_LABELS, statusCategory } from '../utils/visibility';

interface VisibilityPanelProps {
  onClose: () => void;
}

export function VisibilityPanel({ onClose }: VisibilityPanelProps) {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const data = useBeadsStore(state => state.data);
  const statusVisibility = useBeadsStore(state => state.statusVisibility);
  const toggleStatusVisibility = useBeadsStore(state => state.toggleStatusVisibility);
  const resetStatusVisibility = useBeadsStore(state => state.resetStatusVisibility);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const issue of data.issues) {
      const key = statusCategory(issue);
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }, [data]);

  useInput((input, key) => {
    if (key.escape || key.return) {
      onClose();
      return;
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(STATUS_KEYS.length - 1, selectedIndex + 1));
      return;
    }
    if (input === ' ') {
      toggleStatusVisibility(STATUS_KEYS[selectedIndex]);
      return;
    }
    if (input === 'r') {
      resetStatusVisibility();
      return;
    }
  });

  return (
    <Frame title="Show statuses" hints={['Space toggle', 'r reset', 'Esc close']} width={PANEL_WIDTH} floating>
      {STATUS_KEYS.map((key, index) => {
        const isSelected = index === selectedIndex;
        const checked = statusVisibility[key];
        return (
          <Box key={key}>
            <Text color={theme.colors.primary}>{isSelected ? `${glyphs.selectArrow} ` : '  '}</Text>
            <Text color={checked ? theme.colors.success : theme.colors.textDim}>
              {checked ? glyphs.checkboxOn : glyphs.checkboxOff}
            </Text>
            <Text color={getStatusColor(key, theme)} bold={isSelected}> {STATUS_LABELS[key]}</Text>
            <Box flexGrow={1} />
            <Text color={theme.colors.textDim}>{counts[key] ?? 0}</Text>
          </Box>
        );
      })}
      <Text {...theme.ink.faint}>Closed children of a visible parent stay shown.</Text>
    </Frame>
  );
}
