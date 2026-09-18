import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BeadsData, DependencyEdge, Issue } from '../types';
import { readBdJson, workspaceForBeadsPath } from './client';

const KNOWN_STATUSES = ['open', 'closed', 'in_progress', 'blocked'] as const;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined;
}

function dependencyEdges(value: unknown): DependencyEdge[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isObject).map((edge) => ({
    ...edge,
    issue_id: stringValue(edge.issue_id),
    depends_on_id: stringValue(edge.depends_on_id),
    type: stringValue(edge.type),
  }));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeIssue(value: JsonObject): Issue | null {
  const id = stringValue(value.id);
  if (!id) return null;

  const priority = typeof value.priority === 'number'
    ? value.priority
    : Number.parseInt(stringValue(value.priority, '2'), 10);

  const status = stringValue(value.status, 'open');

  return {
    id,
    title: stringValue(value.title),
    description: stringValue(value.description),
    status,
    displayStatus: status,
    priority: Number.isFinite(priority) ? priority : 2,
    issue_type: stringValue(value.issue_type, stringValue(value.type, 'task')),
    assignee: optionalString(value.assignee),
    labels: stringArray(value.labels),
    notes: optionalString(value.notes),
    created_at: stringValue(value.created_at),
    updated_at: stringValue(value.updated_at),
    closed_at: optionalString(value.closed_at),
    dependencies: dependencyEdges(value.dependencies),
  };
}

/**
 * Normalize bd's tolerant JSON DTOs in two passes: issues first, then their edges.
 * Raw status, issue type, and dependency type values are deliberately not coerced.
 */
export function normalizeBeads(value: unknown): BeadsData {
  if (!Array.isArray(value)) {
    throw new Error('bd list returned JSON that is not an array');
  }

  const issues = value.filter(isObject).map(normalizeIssue).filter((issue): issue is Issue => issue !== null);
  const byId = new Map(issues.map((issue) => [issue.id, issue]));

  for (const issue of issues) {
    for (const edge of issue.dependencies) {
      if (!edge.depends_on_id) continue;

      if (edge.type === 'parent-child') {
        issue.parent = edge.depends_on_id;
        const parent = byId.get(edge.depends_on_id);
        if (parent && !parent.children?.includes(issue.id)) {
          (parent.children ??= []).push(issue.id);
        }
      } else if (edge.type === 'blocks') {
        (issue.blockedBy ??= []).push(edge.depends_on_id);
        const blocker = byId.get(edge.depends_on_id);
        if (blocker) (blocker.blocks ??= []).push(issue.id);
      }
    }
  }

  const byStatus: Record<string, Issue[]> = Object.fromEntries(KNOWN_STATUSES.map((status) => [status, []]));
  const stats = { total: issues.length, open: 0, closed: 0, blocked: 0 };

  for (const issue of issues) {
    if (issue.children?.length) {
      const closed = issue.children.reduce((count, childId) => (
        byId.get(childId)?.status === 'closed' ? count + 1 : count
      ), 0);
      issue.progress = {
        closed,
        total: issue.children.length,
        percent: Math.round((closed / issue.children.length) * 100),
      };
    }

    if (issue.blockedBy) {
      issue.blockedBy = issue.blockedBy.filter((id) => {
        const blocker = byId.get(id);
        return blocker !== undefined && blocker.status !== 'closed';
      });
    }

    const effectiveStatus = issue.status === 'open' && issue.blockedBy?.length ? 'blocked' : issue.status;
    const displayStatus = KNOWN_STATUSES.includes(effectiveStatus as typeof KNOWN_STATUSES[number])
      ? effectiveStatus
      : 'other';
    issue.displayStatus = displayStatus;
    (byStatus[displayStatus] ??= []).push(issue);

    if (displayStatus === 'open') stats.open++;
    else if (displayStatus === 'closed') stats.closed++;
    else if (displayStatus === 'blocked') stats.blocked++;
  }

  return { issues, byStatus, byId, stats };
}

/** Read every issue through the supported bd JSON interface. */
export async function loadBeads(beadsPath = '.beads'): Promise<BeadsData> {
  const cwd = workspaceForBeadsPath(beadsPath);
  const value = await readBdJson(['list', '--all', '--limit', '0', '--json'], cwd);
  return normalizeBeads(value);
}

/** Discover the active .beads directory through bd, including redirects. */
export async function findBeadsDir(startPath = process.cwd()): Promise<string | null> {
  try {
    const value = await readBdJson(['where', '--json'], resolve(startPath));
    if (!isObject(value) || typeof value.path !== 'string') return null;

    const path = resolve(value.path);
    return (await stat(path)).isDirectory() ? path : null;
  } catch {
    return null;
  }
}
