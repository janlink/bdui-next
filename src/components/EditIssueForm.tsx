import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { updateIssue, type UpdateIssueParams } from '../bd/commands';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import { Frame, FRAME_INSET } from './Frame';
import { FORM_LABEL_WIDTH, FormRow, formHints } from './FormRow';
import { VALIDATION, validateTitle, PRIORITY_LABELS, STATUS_LABELS } from '../utils/constants';

interface EditIssueFormProps {
  issue: Issue;
  onClose: () => void;
  onSuccess: () => void;
}

type FormField = 'title' | 'status' | 'priority' | 'description' | 'assignee' | 'labels';

const EDITABLE_STATUSES = ['open', 'in_progress', 'blocked', 'closed'];

export function EditIssueForm({ issue, onClose, onSuccess }: EditIssueFormProps) {
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  const glyphs = useBeadsStore(state => state.glyphs);
  const showToast = useBeadsStore(state => state.showToast);
  const showConfirm = useBeadsStore(state => state.showConfirm);
  const showConfirmDialog = useBeadsStore(state => state.showConfirmDialog);
  const addToUndoHistory = useBeadsStore(state => state.addToUndoHistory);
  const theme = useBeadsStore(state => state.theme);

  const [currentField, setCurrentField] = useState<FormField>('title');
  const [formData, setFormData] = useState({
    title: issue.title,
    description: issue.description || '',
    priority: issue.priority,
    status: issue.status,
    assignee: issue.assignee || '',
    labels: issue.labels?.join(', ') || '',
  });
  const statuses = EDITABLE_STATUSES.includes(issue.status)
    ? EDITABLE_STATUSES
    : [issue.status, ...EDITABLE_STATUSES];
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reordered: title -> status -> priority -> description -> assignee -> labels
  // Status is second because it's often the primary reason for editing
  const fields: FormField[] = ['title', 'status', 'priority', 'description', 'assignee', 'labels'];
  const currentFieldIndex = fields.indexOf(currentField);

  // Real-time validation
  const titleValidation = validateTitle(formData.title);
  const titleCharCount = formData.title.length;

  // Track what changed
  const hasChanges =
    formData.title !== issue.title ||
    formData.status !== issue.status ||
    formData.priority !== issue.priority ||
    formData.description !== (issue.description || '') ||
    formData.assignee !== (issue.assignee || '') ||
    formData.labels !== (issue.labels?.join(', ') || '');

  const changedFields: string[] = [];
  if (formData.title !== issue.title) changedFields.push('title');
  if (formData.status !== issue.status) changedFields.push('status');
  if (formData.priority !== issue.priority) changedFields.push('priority');
  if (formData.description !== (issue.description || '')) changedFields.push('description');
  if (formData.assignee !== (issue.assignee || '')) changedFields.push('assignee');
  if (formData.labels !== (issue.labels?.join(', ') || '')) changedFields.push('labels');

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
      if (!hasChanges) {
        setError('No changes to save');
        return;
      }
      // Show confirmation dialog with changed fields
      showConfirm(
        'Update Issue',
        `Update ${issue.id}? Changes: ${changedFields.join(', ')}`,
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

    // Navigation for status field
    if (currentField === 'status') {
      const currentIndex = statuses.indexOf(formData.status);
      if (key.upArrow && currentIndex > 0) {
        setFormData({ ...formData, status: statuses[currentIndex - 1] });
      } else if (key.downArrow && currentIndex < statuses.length - 1) {
        setFormData({ ...formData, status: statuses[currentIndex + 1] });
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
      // Save to undo history before updating
      addToUndoHistory({
        action: 'edit',
        issueId: issue.id,
        previousData: {
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          status: issue.status,
          assignee: issue.assignee,
          labels: issue.labels,
        },
      });

      // Parse labels from comma-separated input
      const labels = formData.labels
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const params: UpdateIssueParams = {
        id: issue.id,
      };

      // Only include changed fields
      if (formData.title !== issue.title) {
        params.title = formData.title;
      }
      if (formData.description !== (issue.description || '')) {
        params.description = formData.description;
      }
      if (formData.priority !== issue.priority) {
        params.priority = formData.priority;
      }
      if (formData.status !== issue.status) {
        params.status = formData.status;
      }
      if (formData.assignee !== (issue.assignee || '')) {
        params.assignee = formData.assignee;
      }

      const currentLabels = issue.labels?.join(', ') || '';
      if (formData.labels !== currentLabels) {
        params.labels = labels;
      }

      await updateIssue(params);

      showToast(`Issue updated: ${changedFields.join(', ')}`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
      setIsSubmitting(false);
    }
  };

  const isFieldChanged = (field: string) => changedFields.includes(field);
  const inner = terminalWidth - FRAME_INSET;
  const row = (field: FormField) => ({ active: currentField === field, changed: isFieldChanged(field), width: inner });
  const changes = hasChanges ? ` ${glyphs.middot} ${changedFields.length} change${changedFields.length !== 1 ? 's' : ''}` : '';

  return (
    <Frame
      title={`Edit ${issue.id}`}
      aside={`field ${currentFieldIndex + 1}/${fields.length}${changes}`}
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
          {...row('status')}
          label="Status"
          kind="choice"
          value={STATUS_LABELS[formData.status] || formData.status}
        />
        <FormRow
          {...row('priority')}
          label="Priority"
          kind="choice"
          value={`P${formData.priority} ${PRIORITY_LABELS[formData.priority]}`}
        />
        <FormRow label="Type" kind="readonly" active={false} width={inner} value={issue.issue_type || 'task'} />
        <FormRow
          {...row('description')}
          label="Description"
          value={formData.description}
          placeholder="no description"
          counter={`${formData.description.length}/${VALIDATION.description.maxLength}`}
        />
        <FormRow {...row('assignee')} label="Assignee" value={formData.assignee} placeholder="unassigned" />
        <FormRow {...row('labels')} label="Labels" value={formData.labels} placeholder="no labels, comma-separated" />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.colors.error} bold>Error: </Text>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}
      {isSubmitting && (
        <Box marginTop={1}>
          <Text color={theme.colors.warning}>Updating issue...</Text>
        </Box>
      )}
    </Frame>
  );
}
