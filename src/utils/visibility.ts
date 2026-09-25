import type { BeadsData, Issue } from '../types';

export type StatusKey = 'open' | 'in_progress' | 'blocked' | 'closed' | 'other';

export const STATUS_KEYS: StatusKey[] = ['open', 'in_progress', 'blocked', 'closed', 'other'];

export const STATUS_LABELS: Record<StatusKey, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  closed: 'Closed',
  other: 'Deferred/Other',
};

export type StatusVisibility = Record<StatusKey, boolean>;

// Closed work is hidden by default; everything still active stays visible.
export const DEFAULT_STATUS_VISIBILITY: StatusVisibility = {
  open: true,
  in_progress: true,
  blocked: true,
  closed: false,
  other: true,
};

// Map an issue's presentation status onto one of the five columns; unknown
// statuses fall back to Other.
export function statusCategory(issue: Issue): StatusKey {
  return (STATUS_KEYS as string[]).includes(issue.displayStatus)
    ? (issue.displayStatus as StatusKey)
    : 'other';
}

export function isStatusVisible(issue: Issue, visibility: StatusVisibility): boolean {
  return visibility[statusCategory(issue)];
}

// Hierarchical visibility: an issue is shown when its own status is visible, or
// when it hangs under an ancestor whose status is visible. This keeps closed
// children of an open epic on screen while hiding closed top-level work.
export function computeVisibleIds(data: BeadsData, visibility: StatusVisibility): Set<string> {
  const { byId } = data;
  const visible = new Set<string>();

  for (const issue of data.issues) {
    if (isStatusVisible(issue, visibility)) {
      visible.add(issue.id);
      continue;
    }

    const seen = new Set<string>();
    let parentId = issue.parent;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      if (isStatusVisible(parent, visibility)) {
        visible.add(issue.id);
        break;
      }
      parentId = parent.parent;
    }
  }

  return visible;
}

// The tree view draws hierarchy, so a match must not appear detached from the epic
// it belongs to: add each match's ancestor chain as context. Ancestors outside
// `allowed` stay out, and the walk continues past them, so a status-hidden
// parent does not resurface while a visible grandparent still anchors the row.
export function withAncestors(
  data: BeadsData,
  matched: Set<string>,
  allowed: Set<string>,
): Set<string> {
  const { byId } = data;
  const result = new Set(matched);

  for (const id of matched) {
    const seen = new Set<string>();
    let parentId = byId.get(id)?.parent;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      if (allowed.has(parentId)) result.add(parentId);
      parentId = byId.get(parentId)?.parent;
    }
  }

  return result;
}
