import React from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';

export function HelpOverlay() {
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <Box
        flexDirection="column"
        borderStyle={glyphs.border('double')}
        borderColor={theme.colors.primary}
        padding={2}
        backgroundColor={theme.colors.surface}
      >
        <Box marginBottom={1}>
          <Text {...theme.ink.strong} bold>BD TUI - Keyboard Shortcuts</Text>
        </Box>

        <Box flexDirection="column" gap={0}>
          <Text {...theme.ink.strong} bold>Navigation:</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>left/right / h/l</Text>  Move between columns</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>up/down / k/j</Text>    Move up/down in column</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>0</Text>               Jump to first issue</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>$ or G</Text>          Jump to last issue</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>: or g</Text>          Open command bar</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1}>
          <Text {...theme.ink.strong} bold>Views:</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>1</Text>              Tree view (hierarchical)</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>2</Text>              Kanban board view</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>3</Text>              Statistics & analytics dashboard</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>4</Text>              Memories (bd remember; d delete, r refresh)</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1}>
          <Text {...theme.ink.strong} bold>Search & Filter:</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>/</Text>              Open search</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>f</Text>              Open filter panel</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>v</Text>              Choose which statuses are shown</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>c</Text>              Clear all filters and search</Text>
          <Text {...theme.ink.faint}>  (Closed is hidden by default; children of a shown parent stay visible)</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1}>
          <Text {...theme.ink.strong} bold>Actions:</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>N</Text>              Create new issue (Shift+N)</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>e</Text>              Edit selected issue</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>x</Text>              Export/copy selected issue</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>Enter / Space</Text>  Toggle detail panel</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>PgUp / PgDn</Text>    Page the description (the arrows too when the panel fills the view)</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>r</Text>              Refresh data</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>u</Text>              Undo (view history)</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1}>
          <Text {...theme.ink.strong} bold>Other:</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>t</Text>              Change theme / color scheme</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>n</Text>              Toggle notifications (sound + native)</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>?</Text>              Toggle this help</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>q / Ctrl+C</Text>     Quit</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1} borderTop borderColor={theme.colors.border} paddingTop={1}>
          <Text {...theme.ink.strong} bold>Command Bar (: or g):</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:5</Text>              Jump to page 5</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:issue-id</Text>       Jump to issue by ID</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:s o/i/b/c</Text>      Set status</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:p 0-4</Text>          Set priority (P0 Critical {glyphs.arrowRight} P4 Backlog)</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:kanban/tree/stats/mem</Text>        Switch view</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:theme name</Text>     Change theme</Text>
          <Text {...theme.ink.dim}>  <Text {...theme.ink.strong}>:new :edit :q</Text>   Create, edit, quit</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1} borderTop borderColor={theme.colors.border} paddingTop={1}>
          <Text {...theme.ink.strong} bold>Forms:</Text>
          <Text {...theme.ink.faint}>  Tab / Shift+Tab   Navigate between fields</Text>
          <Text {...theme.ink.faint}>  up/down           Change priority/status/type</Text>
          <Text {...theme.ink.faint}>  Enter             Submit (with confirmation)</Text>
          <Text {...theme.ink.faint}>  ESC               Cancel and return</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1} borderTop borderColor={theme.colors.border} paddingTop={1}>
          <Text {...theme.ink.faint}>Notifications alert you when:</Text>
          <Text {...theme.ink.faint}>  - Tasks are completed (status changes to closed)</Text>
          <Text {...theme.ink.faint}>  - Tasks become blocked</Text>
        </Box>

        <Box flexDirection="column" gap={0} marginTop={1} borderTop borderColor={theme.colors.border} paddingTop={1}>
          <Text {...theme.ink.strong} bold>Terminal:</Text>
          <Text {...theme.ink.faint}>  bdui --glyph-check   Print all three glyph tiers to pick one</Text>
          <Text {...theme.ink.faint}>  BDUI_GLYPHS          fancy | safe | ascii</Text>
          <Text {...theme.ink.faint}>  BDUI_COLOR           auto | 256 | 16 | none</Text>
          <Text {...theme.ink.faint}>  BDUI_AMBIGUOUS       auto | narrow | wide</Text>
        </Box>

        <Box marginTop={2} justifyContent="center">
          <Text {...theme.ink.faint}>Press ? to close</Text>
        </Box>
      </Box>
    </Box>
  );
}
