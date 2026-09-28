import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import stringWidth from 'string-width';
import { useBeadsStore } from '../state/store';
import { Frame } from './Frame';

const PANEL_WIDTH = 60;
import { getTheme, getThemeNames } from '../themes/themes';

interface ThemeSelectorProps {
  onClose: () => void;
}

export function ThemeSelector({ onClose }: ThemeSelectorProps) {
  const currentTheme = useBeadsStore(state => state.currentTheme);
  const setTheme = useBeadsStore(state => state.setTheme);
  const colorDepth = useBeadsStore(state => state.colorDepth);
  const glyphs = useBeadsStore(state => state.glyphs);
  const activeTheme = useBeadsStore(state => state.theme);

  const themeNames = getThemeNames();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, themeNames.indexOf(currentTheme))
  );

  useInput((input, key) => {
    // ESC to close
    if (key.escape) {
      onClose();
      return;
    }

    // Navigate with up/down or k/j
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(themeNames.length - 1, selectedIndex + 1));
      return;
    }

    // Enter to select theme
    if (key.return) {
      setTheme(themeNames[selectedIndex]);
      onClose();
      return;
    }
  });

  const labelWidth = Math.max(...themeNames.map(name => stringWidth(getTheme(name, colorDepth).label)));

  return (
    <Frame
      title="Select theme"
      hints={[`${glyphs.scrollUp}${glyphs.scrollDown} move`, 'Enter select', 'Esc cancel']}
      width={PANEL_WIDTH}
      floating
    >
      <Box flexDirection="column" marginTop={1}>
        {themeNames.map((themeName, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = themeName === currentTheme;
          // The swatches have to show what this depth can actually paint.
          const theme = getTheme(themeName, colorDepth);
          const pad = ' '.repeat(labelWidth - stringWidth(theme.label));

          return (
            <Box key={themeName} gap={2}>
              <Text {...(isSelected ? activeTheme.ink.strong : activeTheme.ink.text)} bold={isSelected}>
                <Text color={activeTheme.colors.primary}>{isSelected ? `${glyphs.selectArrow} ` : '  '}</Text>
                {theme.label}{pad}
              </Text>
              <Box gap={1}>
                <Text color={theme.colors.statusOpen}>{glyphs.themeSwatch}</Text>
                <Text color={theme.colors.statusInProgress}>{glyphs.themeSwatch}</Text>
                <Text color={theme.colors.statusBlocked}>{glyphs.themeSwatch}</Text>
                <Text color={theme.colors.statusClosed}>{glyphs.themeSwatch}</Text>
              </Box>
              <Text>
                <Text color={theme.colors.typeEpic}>E</Text>
                <Text color={theme.colors.typeFeature}>F</Text>
                <Text color={theme.colors.typeBug}>B</Text>
                <Text color={theme.colors.typeTask}>T</Text>
                <Text color={theme.colors.typeChore}>C</Text>
              </Text>
              {isCurrent && <Text color={activeTheme.colors.success}>current</Text>}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text {...activeTheme.ink.faint}>Swatches: status colors, then issue type letters</Text>
      </Box>
    </Frame>
  );
}
