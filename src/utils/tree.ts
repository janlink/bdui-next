import type { BeadsData, Issue } from '../types';

export interface TreeNode {
  issue: Issue;
  children: TreeNode[];
  depth: number;
}

export interface FlatNode {
  issue: Issue;
  depth: number;
  isLast: boolean;
  prefix: string;
  hasChildren: boolean;
  collapsed: boolean;
  parentId: string | null;
}

const NO_COLLAPSED: ReadonlySet<string> = new Set();

// Build the parent/child hierarchy, then prune it to the visible set. Hidden
// nodes are dropped and their visible descendants are lifted to the hidden
// node's position, so the tree stays connected and correctly indented.
export function buildVisibleTree(data: BeadsData, visibleIds: Set<string>): TreeNode[] {
  const { byId } = data;
  const processed = new Set<string>();

  const rootIssues = data.issues.filter(issue => !issue.parent || !byId.has(issue.parent));

  function build(issue: Issue, depth: number): TreeNode {
    processed.add(issue.id);
    const node: TreeNode = { issue, children: [], depth };
    for (const childId of issue.children ?? []) {
      const child = byId.get(childId);
      if (child && !processed.has(childId)) {
        node.children.push(build(child, depth + 1));
      }
    }
    return node;
  }

  const roots: TreeNode[] = [];
  for (const issue of rootIssues) {
    if (!processed.has(issue.id)) roots.push(build(issue, 0));
  }

  function prune(nodes: TreeNode[], depth: number): TreeNode[] {
    const out: TreeNode[] = [];
    for (const node of nodes) {
      if (visibleIds.has(node.issue.id)) {
        node.depth = depth;
        node.children = prune(node.children, depth + 1);
        out.push(node);
      } else {
        out.push(...prune(node.children, depth));
      }
    }
    return out;
  }

  return prune(roots, 0);
}

export function flattenTree(roots: TreeNode[], collapsed: ReadonlySet<string> = NO_COLLAPSED): FlatNode[] {
  const flat: FlatNode[] = [];

  function traverse(node: TreeNode, prefix: string, isLast: boolean, parentId: string | null) {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.issue.id);
    flat.push({ issue: node.issue, depth: node.depth, isLast, prefix, hasChildren, collapsed: isCollapsed, parentId });

    if (!hasChildren || isCollapsed) return;
    // A root has no branch of its own, so its children start at the column and
    // no stem runs from one root down to the next; below that, every level
    // costs two cells.
    const stem = node.depth === 0 ? '' : isLast ? '  ' : '│ ';
    for (let i = 0; i < node.children.length; i++) {
      const childIsLast = i === node.children.length - 1;
      traverse(node.children[i], prefix + stem, childIsLast, node.issue.id);
    }
  }

  for (let i = 0; i < roots.length; i++) {
    traverse(roots[i], '', i === roots.length - 1, null);
  }

  return flat;
}

/** Every node with children, at any depth: the set that folds the tree to its roots. */
export function parentIds(roots: TreeNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (node: TreeNode) => {
    if (node.children.length === 0) return;
    ids.add(node.issue.id);
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  return ids;
}

/** The root above the row at `index`, following its parent chain through `flat`. */
export function rootIdOf(flat: FlatNode[], index: number): string | undefined {
  let node: FlatNode | undefined = flat[index];
  while (node?.parentId) {
    const parentId: string = node.parentId;
    node = flat.find(n => n.issue.id === parentId);
  }
  return node?.issue.id;
}
