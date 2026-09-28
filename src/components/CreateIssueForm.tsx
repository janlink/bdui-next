import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { createIssue } from '../bd/commands';
import { useBeadsStore } from '../state/store';
import { Frame, FRAME_INSET } from './Frame';
import { FORM_LABEL_WIDTH, FormRow, formHints } from './FormRow';
import { VALIDATION, validateTitle, PRIORITY_LABELS } from '../utils/constants';

interface CreateIssueFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

type FormField = 'title' | 'priority' | 'type' | 'description' | 'assignee' | 'labels';

type CreatableIssueType = 'task' | 'epic' | 'bug' | 'feature' | 'chore' | 'decision';
const ISSUE_TYPES: CreatableIssueType[] = ['task', 'epic', 'bug', 'feature', 'chore', 'decision'];

export function CreateIssueForm({ onClose, onSuccess }: CreateIssueFormProps) {
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  const glyphs = useBeadsStore(state => state.glyphs);
  const showToast = useBeadsStore(state => state.showToast);
  const showConfirm = useBeadsStore(state => state.showConfirm);
  const showConfirmDialog = useBeadsStore(state => state.showConfirmDialog);
  const theme = useBeadsStore(state => state.theme);

  const [currentField, setCurrentField] = useState<FormField>('title');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 2,
    issueType: 'task' as CreatableIssueType,
    assignee: '',
    labels: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reordered: title -> priority -> type -> description -> assignee -> labels
  const fields: FormField[] = ['title', 'priority', 'type', 'description', 'assignee', 'labels'];
  const currentFieldIndex = fields.indexOf(currentField);

  // Real-time validation
  const titleValidation = validateTitle(formData.title);
  const titleCharCount = formData.title.length;

  useInput((input, key) => {
    // Don't handle input when confirm dialog is open
    if (showConfirmDialog) return;

    // ESC to close
    if (key.escape) {
      onClose();
      return;
    }

    // Tab to next field
    if (key.tab && !key.shift) {
      if (currentFieldIndex < fields.length - 1) {
        setCurrentField(fields[currentFieldIndex + 1]);
      }
      return;
    }

    // Shift+Tab to previous field
    if (key.tab && key.shift) {
      if (currentFieldIndex > 0) {
        setCurrentField(fields[currentFieldIndex - 1]);
      }
      return;
    }

    // Enter to submit (with confirmation)
    if (key.return && !isSubmitting) {
      if (!titleValidation.valid) {
        setError(titleValidation.error || 'Invalid title');
        return;
      }
      // Show confirmation dialog
      showConfirm(
        'Create Issue',
        `Create issue "${formData.title.substring(0, 40)}${formData.title.length > 40 ? '...' : ''}"?`,
        handleSubmit
      );
      return;
    }

    // Handle input for text fields
    if (currentField === 'title' || currentField === 'description' || currentField === 'assignee' || currentField === 'labels') {
      if (key.backspace || key.delete) {
        setFormData({
          ...formData,
          [currentField]: formData[currentField].slice(0, -1),
        });
        setError(null);
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        const currentValue = formData[currentField];
        const maxLength = currentField === 'title'
          ? VALIDATION.title.maxLength
          : currentField === 'description'
          ? VALIDATION.description.maxLength
          : VALIDATION.assignee.maxLength;

        if (currentValue.length < maxLength) {
          setFormData({
            ...formData,
            [currentField]: currentValue + input,
          });
          setError(null);
        }
      }
      return;
    }

    // Navigation for priority field
    if (currentField === 'priority') {
      if (key.upArrow && formData.priority > 0) {
        setFormData({ ...formData, priority: formData.priority - 1 });
      } else if (key.downArrow && formData.priority < 4) {
        setFormData({ ...formData, priority: formData.priority + 1 });
      }
      return;
    }

    // Navigation for type field
    if (currentField === 'type') {
      const currentIndex = ISSUE_TYPES.indexOf(formData.issueType);
      if (key.upArrow && currentIndex > 0) {
        setFormData({ ...formData, issueType: ISSUE_TYPES[currentIndex - 1] });
      } else if (key.downArrow && currentIndex < ISSUE_TYPES.length - 1) {
        setFormData({ ...formData, issueType: ISSUE_TYPES[currentIndex + 1] });
      }
      return;
    }
  });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Parse labels from comma-separated input
      const labels = formData.labels
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      await createIssue({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        issueType: formData.issueType,
        assignee: formData.assignee.trim() || undefined,
        labels: labels.length > 0 ? labels : undefined,
      });

      showToast(`Issue created: ${formData.title.substring(0, 30)}${formData.title.length > 30 ? '...' : ''}`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
      setIsSubmitting(false);
    }
  };

  const inner = terminalWidth - FRAME_INSET;
  const row = (field: FormField) => ({ active: currentField === field, width: inner });

  return (
    <Frame
      title="New issue"
      aside={`field ${currentFieldIndex + 1}/${fields.length}`}
      hints={formHints(glyphs)}
      width={terminalWidth}
    >
      <Box flexDirection="column" marginTop={1} gap={1}>
        <Box flexDirection="column">
          <FormRow
            {...row('title')}
            label="Title"
            required
            value={formData.title}
            placeholder="issue title"
            invalid={!titleValidation.valid && formData.title !== ''}
            counter={`${titleCharCount}/${VALIDATION.title.maxLength}`}
            counterWarning={titleCharCount > VALIDATION.title.maxLength * 0.9}
          />
          {currentField === 'title' && !titleValidation.valid && formData.title !== '' && (
            <Box marginLeft={FORM_LABEL_WIDTH}>
              <Text color={theme.colors.error}>{titleValidation.error}</Text>
            </Box>
          )}
        </Box>
        <FormRow
          {...row('priority')}
          label="Priority"
          kind="choice"
          value={`P${formData.priority} ${PRIORITY_LABELS[formData.priority]}`}
        />
        <FormRow {...row('type')} label="Type" kind="choice" value={formData.issueType} />
        <FormRow
          {...row('description')}
          label="Description"
          value={formData.description}
          placeholder="optional"
          counter={`${formData.description.length}/${VALIDATION.description.maxLength}`}
        />
        <FormRow {...row('assignee')} label="Assignee" value={formData.assignee} placeholder="optional" />
        <FormRow {...row('labels')} label="Labels" value={formData.labels} placeholder="optional, comma-separated" />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.colors.error} bold>Error: </Text>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}
      {isSubmitting && (
        <Box marginTop={1}>
          <Text color={theme.colors.warning}>Creating issue...</Text>
        </Box>
      )}
    </Frame>
  );
}
