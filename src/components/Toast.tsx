import React from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';

export function Toast() {
  const toastMessage = useBeadsStore(state => state.toastMessage);
  const glyphs = useBeadsStore(state => state.glyphs);
  const theme = useBeadsStore(state => state.theme);

  if (!toastMessage) return null;

  const colorMap = {
    success: theme.colors.success,
    error: theme.colors.error,
    info: theme.colors.primary,
  };

  const iconMap = {
    success: '[OK]',
    error: '[!]',
    info: '[i]',
  };

  const color = colorMap[toastMessage.type];
  const icon = iconMap[toastMessage.type];

  return (
    <Box
      position="absolute"
      width="100%"
      justifyContent="center"
      paddingX={1}
    >
      <Box
        borderStyle={glyphs.border('round')}
        borderColor={color}
        paddingX={2}
        paddingY={0}
      >
        <Text color={color} bold>
          {icon} {toastMessage.message}
        </Text>
      </Box>
    </Box>
  );
}
