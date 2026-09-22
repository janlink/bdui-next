import { expect, test } from 'bun:test';
import { normalizeBeads } from '../bd/parser';
import { detectChanges } from './changes';

const before = normalizeBeads([
  { id: 'epic', title: 'Epic', status: 'open', issue_type: 'epic', priority: 1 },
  { id: 'child', title: 'Child', status: 'open', issue_type: 'task', priority: 2, labels: ['a', 'b'],
    dependencies: [{ issue_id: 'child', depends_on_id: 'epic', type: 'parent-child' }] },
  { id: 'same', title: 'Untouched', status: 'open', issue_type: 'task', priority: 3 },
]);

test('marks added issues new and edited ones changed', () => {
  const after = normalizeBeads([
    { id: 'epic', title: 'Epic', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'child', title: 'Child renamed', status: 'open', issue_type: 'task', priority: 2, labels: ['a', 'b'],
      dependencies: [{ issue_id: 'child', depends_on_id: 'epic', type: 'parent-child' }] },
    { id: 'same', title: 'Untouched', status: 'open', issue_type: 'task', priority: 3 },
    { id: 'added', title: 'Added', status: 'open', issue_type: 'bug', priority: 0 },
  ]);
  expect([...detectChanges(before.byId, after.byId)]).toEqual([
    ['child', 'changed'],
    ['added', 'new'],
  ]);
});

test('a parent whose child closes keeps no badge of its own', () => {
  const after = normalizeBeads([
    { id: 'epic', title: 'Epic', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'child', title: 'Child', status: 'closed', issue_type: 'task', priority: 2, labels: ['a', 'b'],
      dependencies: [{ issue_id: 'child', depends_on_id: 'epic', type: 'parent-child' }] },
    { id: 'same', title: 'Untouched', status: 'open', issue_type: 'task', priority: 3 },
  ]);
  expect(after.byId.get('epic')!.progress).not.toEqual(before.byId.get('epic')!.progress);
  expect([...detectChanges(before.byId, after.byId).keys()]).toEqual(['child']);
});

test('label order alone is no change', () => {
  const after = normalizeBeads([
    { id: 'epic', title: 'Epic', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'child', title: 'Child', status: 'open', issue_type: 'task', priority: 2, labels: ['b', 'a'],
      dependencies: [{ issue_id: 'child', depends_on_id: 'epic', type: 'parent-child' }] },
    { id: 'same', title: 'Untouched', status: 'open', issue_type: 'task', priority: 3 },
  ]);
  expect(detectChanges(before.byId, after.byId).size).toBe(0);
});
