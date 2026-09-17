import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';

export function SearchInput() {
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const glyphs = useBeadsStore(state => state.glyphs);
  const setSearchQuery = useBeadsStore(state => state.setSearchQuery);
  const toggleSearch = useBeadsStore(state => state.toggleSearch);
  const getFilteredIssues = useBeadsStore(state => state.getFilteredIssues);
  const totalCount = useBeadsStore(state => state.data.issues.length);
  const theme = useBeadsStore(state => state.theme);

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
    <Box
      flexDirection="column"
      borderStyle={glyphs.border('single')}
      borderColor={theme.colors.primary}
      paddingX={1}
      marginBottom={1}
    >
      <Box gap={2}>
        <Box>
          <Text bold color={theme.colors.primary}>Search: </Text>
          <Text color={theme.colors.text}>{searchQuery}</Text>
          <Text color={theme.colors.textDim}>|</Text>
        </Box>
        {searchQuery.trim() && (
          <Text color={theme.colors.textDim}>
            {filteredCount}/{totalCount} match{filteredCount !== 1 ? 'es' : ''}
          </Text>
        )}
      </Box>
      <Text color={theme.colors.textDim}>
        type:x label:x p0-p4, words match id/title/desc/assignee/labels | ESC to close
      </Text>
    </Box>
  );
}
