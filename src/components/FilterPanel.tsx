import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { PRIORITY_LABELS } from '../utils/constants';

export function FilterPanel() {
  const data = useBeadsStore(state => state.data);
  const filter = useBeadsStore(state => state.filter);
  const setFilter = useBeadsStore(state => state.setFilter);
  const clearFilters = useBeadsStore(state => state.clearFilters);
  const toggleFilter = useBeadsStore(state => state.toggleFilter);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  const [selectedFilterType, setSelectedFilterType] = useState<'assignee' | 'tags' | 'priority' | 'status'>('assignee');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Get unique values for filters
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    data.issues.forEach(issue => {
      if (issue.assignee) assignees.add(issue.assignee);
    });
    return Array.from(assignees).sort();
  }, [data.issues]);

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    data.issues.forEach(issue => {
      issue.labels?.forEach(label => tags.add(label));
    });
    return Array.from(tags).sort();
  }, [data.issues]);

  const priorities = [0, 1, 2, 3, 4];
  const statuses = ['open', 'in_progress', 'blocked', 'closed', 'other'];

  // Get current filter options based on selected type
  const getCurrentOptions = () => {
    switch (selectedFilterType) {
      case 'assignee': return uniqueAssignees;
      case 'tags': return uniqueTags;
      case 'priority': return priorities;
      case 'status': return statuses;
    }
  };

  const currentOptions = getCurrentOptions();

  useInput((input, key) => {
    // Close with Escape
    if (key.escape) {
      toggleFilter();
      return;
    }

    // Switch filter type with Tab
    if (key.tab) {
      const types: Array<'assignee' | 'tags' | 'priority' | 'status'> = ['assignee', 'tags', 'priority', 'status'];
      const currentIdx = types.indexOf(selectedFilterType);
      const nextIdx = (currentIdx + 1) % types.length;
      setSelectedFilterType(types[nextIdx]);
      setSelectedIndex(0);
      return;
    }

    // Navigate options
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(currentOptions.length - 1, selectedIndex + 1));
      return;
    }

    // Toggle selection with Enter or Space
    if (key.return || input === ' ') {
      const value = currentOptions[selectedIndex];

      switch (selectedFilterType) {
        case 'assignee':
          setFilter({
            ...filter,
            assignee: filter.assignee === value ? undefined : String(value),
          });
          break;

        case 'tags':
          const currentTags = filter.tags || [];
          const tagValue = String(value);
          const newTags = currentTags.includes(tagValue)
            ? currentTags.filter(t => t !== tagValue)
            : [...currentTags, tagValue];
          setFilter({
            ...filter,
            tags: newTags.length > 0 ? newTags : undefined,
          });
          break;

        case 'priority':
          setFilter({
            ...filter,
            priority: filter.priority === value ? undefined : Number(value),
          });
          break;

        case 'status':
          setFilter({
            ...filter,
            status: filter.status === value ? undefined : String(value),
          });
          break;
      }
      return;
    }

    // Clear all filters with 'c'
    if (input === 'c') {
      clearFilters();
      return;
    }
  });

  const isSelected = (type: string, value: any): boolean => {
    switch (type) {
      case 'assignee':
        return filter.assignee === value;
      case 'tags':
        return filter.tags?.includes(String(value)) || false;
      case 'priority':
        return filter.priority === value;
      case 'status':
        return filter.status === value;
      default:
        return false;
    }
  };

  const getPriorityLabel = (priority: number) => `P${priority} (${PRIORITY_LABELS[priority]})`;

  return (
    <Box
      flexDirection="column"
      borderStyle={glyphs.border('double')}
      borderColor={theme.colors.primary}
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Text {...theme.ink.strong}>Filters </Text>
        <Text {...theme.ink.faint}>
          (Tab to switch {glyphs.bullet} {glyphs.scrollUp}{glyphs.scrollDown} navigate {glyphs.bullet} Space to toggle {glyphs.bullet} C to clear {glyphs.bullet} ESC to close)
        </Text>
      </Box>

      <Box marginTop={1} gap={2}>
        {/* Assignee Filter */}
        <Box flexDirection="column" width={25}>
          <Text
            bold
            color={selectedFilterType === 'assignee' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'assignee'}
          >
            Assignee
          </Text>
          {uniqueAssignees.length === 0 ? (
            <Text {...theme.ink.faint}>  No assignees</Text>
          ) : (
            uniqueAssignees.slice(0, 5).map((assignee, idx) => (
              <Box key={assignee}>
                <Text color={selectedFilterType === 'assignee' && idx === selectedIndex ? theme.colors.primary : theme.colors.text}>
                  {selectedFilterType === 'assignee' && idx === selectedIndex ? `${glyphs.selectArrow} ` : '  '}
                  {isSelected('assignee', assignee) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                  {assignee}
                </Text>
              </Box>
            ))
          )}
          {uniqueAssignees.length > 5 && <Text {...theme.ink.faint}>  ... +{uniqueAssignees.length - 5} more</Text>}
        </Box>

        {/* Tags Filter */}
        <Box flexDirection="column" width={25}>
          <Text
            bold
            color={selectedFilterType === 'tags' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'tags'}
          >
            Tags
          </Text>
          {uniqueTags.length === 0 ? (
            <Text {...theme.ink.faint}>  No tags</Text>
          ) : (
            uniqueTags.slice(0, 5).map((tag, idx) => (
              <Box key={tag}>
                <Text color={selectedFilterType === 'tags' && idx === selectedIndex ? theme.colors.primary : theme.colors.text}>
                  {selectedFilterType === 'tags' && idx === selectedIndex ? `${glyphs.selectArrow} ` : '  '}
                  {isSelected('tags', tag) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                  {tag}
                </Text>
              </Box>
            ))
          )}
          {uniqueTags.length > 5 && <Text {...theme.ink.faint}>  ... +{uniqueTags.length - 5} more</Text>}
        </Box>

        {/* Priority Filter */}
        <Box flexDirection="column" width={30}>
          <Text
            bold
            color={selectedFilterType === 'priority' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'priority'}
          >
            Priority
          </Text>
          {priorities.map((priority, idx) => (
            <Box key={priority}>
              <Text color={selectedFilterType === 'priority' && idx === selectedIndex ? theme.colors.primary : theme.colors.text}>
                {selectedFilterType === 'priority' && idx === selectedIndex ? `${glyphs.selectArrow} ` : '  '}
                {isSelected('priority', priority) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                {getPriorityLabel(priority)}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Status Filter */}
        <Box flexDirection="column" width={25}>
          <Text
            bold
            color={selectedFilterType === 'status' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'status'}
          >
            Status
          </Text>
          {statuses.map((status, idx) => (
            <Box key={status}>
              <Text color={selectedFilterType === 'status' && idx === selectedIndex ? theme.colors.primary : theme.colors.text}>
                {selectedFilterType === 'status' && idx === selectedIndex ? `${glyphs.selectArrow} ` : '  '}
                {isSelected('status', status) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                {status}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Active filters summary */}
      <Box marginTop={1} borderStyle={glyphs.border('single')} borderColor={theme.colors.border} paddingX={1}>
        <Text {...theme.ink.faint}>Active: </Text>
        {filter.assignee && <Text {...theme.ink.text}>{filter.assignee} </Text>}
        {filter.tags && filter.tags.length > 0 && <Text {...theme.ink.text}>{filter.tags.join(', ')} </Text>}
        {filter.priority !== undefined && <Text {...theme.ink.text}>P{filter.priority} </Text>}
        {filter.status && <Text {...theme.ink.text}>{filter.status} </Text>}
        {!filter.assignee && (!filter.tags || filter.tags.length === 0) && filter.priority === undefined && !filter.status && (
          <Text {...theme.ink.faint}>None</Text>
        )}
      </Box>
    </Box>
  );
}
