import { canonicalize } from '../bd/watcher';
import type { Issue } from '../types';

export type ChangeKind = 'new' | 'changed';

export interface RecentChange {
  kind: ChangeKind;
  expiresAt: number;
}

/** How long a change badge stays on an issue after the reload that brought it. */
export const RECENT_CHANGE_MS = 5_000;

// Only what bd reports counts. The derived relationships would badge a parent
// whenever one of its children moved, and its progress with it.
function rawFingerprint(issue: Issue): string {
  const { children, blockedBy, blocks, progress, displayStatus, ...raw } = issue;
  return JSON.stringify(canonicalize({
    ...raw,
    labels: [...(raw.labels ?? [])].sort(),
    dependencies: raw.dependencies.map(edge => JSON.stringify(canonicalize(edge))).sort(),
  }));
}

/** Issues that appeared or whose bd fields differ between two snapshots. */
export function detectChanges(
  before: ReadonlyMap<string, Issue>,
  after: ReadonlyMap<string, Issue>,
): Map<string, ChangeKind> {
  const changes = new Map<string, ChangeKind>();
  for (const [id, issue] of after) {
    const previous = before.get(id);
    if (!previous) changes.set(id, 'new');
    else if (rawFingerprint(previous) !== rawFingerprint(issue)) changes.set(id, 'changed');
  }
  return changes;
}
