import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
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
    <Box
      flexDirection="column"
      borderStyle={glyphs.border('double')}
      borderColor={theme.colors.primary}
      padding={1}
      width={48}
      backgroundColor={theme.colors.surface}
    >
      <Text bold color={theme.colors.primary}>Show statuses</Text>
      <Text color={theme.colors.textDim}>Space toggle {glyphs.middot} r reset {glyphs.middot} Esc/Enter close</Text>

      <Box flexDirection="column" marginTop={1}>
        {STATUS_KEYS.map((key, index) => {
          const isSelected = index === selectedIndex;
          const checked = statusVisibility[key];
          return (
            <Box key={key}>
              <Text color={theme.colors.primary}>{isSelected ? `${glyphs.caretCollapsed} ` : '  '}</Text>
              <Text color={checked ? theme.colors.success : theme.colors.textDim}>
                {checked ? '[x]' : '[ ]'}
              </Text>
              <Text color={getStatusColor(key, theme)}> {STATUS_LABELS[key]}</Text>
              <Box flexGrow={1} />
              <Text color={theme.colors.textDim}>{counts[key] ?? 0}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.textDim}>
          Closed children of a visible parent stay shown.
        </Text>
      </Box>
    </Box>
  );
}
