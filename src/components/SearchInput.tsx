import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { Cursor, Frame } from './Frame';

export function SearchInput() {
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const glyphs = useBeadsStore(state => state.glyphs);
  const setSearchQuery = useBeadsStore(state => state.setSearchQuery);
  const toggleSearch = useBeadsStore(state => state.toggleSearch);
  const getFilteredIssues = useBeadsStore(state => state.getFilteredIssues);
  const totalCount = useBeadsStore(state => state.data.issues.length);
  const theme = useBeadsStore(state => state.theme);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);

  const filteredCount = getFilteredIssues().length;

  useInput((input, key) => {
    if (key.escape || key.return) {
      toggleSearch();
      return;
    }

    if (key.backspace || key.delete) {
      setSearchQuery(searchQuery.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && input) {
      const printable = input.replace(/\p{Cc}/gu, '');
      if (printable) setSearchQuery(searchQuery + printable);
    }
  });

  return (
    <Frame
      title="Search"
      aside={searchQuery.trim() ? `${filteredCount}/${totalCount} match${filteredCount !== 1 ? 'es' : ''}` : ''}
      hints={['type:x', 'label:x', 'p0-p4', 'Enter/Esc close']}
      width={terminalWidth}
    >
      <Box>
        <Text color={theme.colors.primary}>{glyphs.selectArrow} </Text>
        <Text color={theme.colors.text}>{searchQuery}</Text>
        <Cursor />
        {!searchQuery && <Text {...theme.ink.faint}> words match id, title, description, assignee, labels</Text>}
      </Box>
    </Frame>
  );
}
