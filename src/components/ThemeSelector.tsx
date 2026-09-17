import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
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

  return (
    <Box
      flexDirection="column"
      borderStyle={glyphs.border('double')}
      borderColor={activeTheme.colors.primary}
      padding={1}
      width={60}
      backgroundColor={activeTheme.colors.surface}
    >
      <Text {...activeTheme.ink.strong}>
        Select Theme
      </Text>
      <Text {...activeTheme.ink.faint}>
        ESC to cancel | {glyphs.scrollUp}/{glyphs.scrollDown} or k/j to navigate | Enter to select
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {themeNames.map((themeName, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = themeName === currentTheme;
          // The swatches have to show what this depth can actually paint.
          const theme = getTheme(themeName, colorDepth);

          return (
            <Box
              key={themeName}
              borderStyle={isSelected ? glyphs.border('single') : undefined}
              borderColor={isSelected ? activeTheme.colors.primary : undefined}
              paddingX={1}
              marginBottom={1}
            >
              <Box flexDirection="column" width="100%">
                <Box>
                  <Text {...(isSelected ? activeTheme.ink.strong : activeTheme.ink.text)}>
                    {isSelected ? `${glyphs.selectArrow} ` : '  '}
                    {theme.label}
                  </Text>
                  {isCurrent && (
                    <Text color={activeTheme.colors.success}> (current)</Text>
                  )}
                </Box>

                {/* Color preview */}
                <Box gap={1} marginTop={0}>
                  <Text color={theme.colors.statusOpen}>{glyphs.themeSwatch}</Text>
                  <Text color={theme.colors.statusInProgress}>{glyphs.themeSwatch}</Text>
                  <Text color={theme.colors.statusBlocked}>{glyphs.themeSwatch}</Text>
                  <Text color={theme.colors.statusClosed}>{glyphs.themeSwatch}</Text>
                  <Text {...activeTheme.ink.faint}>|</Text>
                  <Text color={theme.colors.typeEpic}>E</Text>
                  <Text color={theme.colors.typeFeature}>F</Text>
                  <Text color={theme.colors.typeBug}>B</Text>
                  <Text color={theme.colors.typeTask}>T</Text>
                  <Text color={theme.colors.typeChore}>C</Text>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} borderTop borderColor={activeTheme.colors.border} paddingTop={1}>
        <Text {...activeTheme.ink.faint}>
          Preview shows: Status colors | Issue type indicators
        </Text>
      </Box>
    </Box>
  );
}
