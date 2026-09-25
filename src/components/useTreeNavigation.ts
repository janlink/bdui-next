import { useState, useMemo, useEffect } from 'react';
import { useInput } from 'ink';
import { useBeadsStore, isModalOpen } from '../state/store';
import type { Issue } from '../types';
import { flattenTree, parentIds, rootIdOf, type TreeNode, type FlatNode } from '../utils/tree';

interface NavState {
  selectedIndex: number;
  scrollOffset: number;
}

export interface TreeNavigation {
  flatNodes: FlatNode[];
  selectedIndex: number;
  scrollOffset: number;
  selectedIssue: Issue | undefined;
}

// Keyboard navigation for the tree view: vertical movement, collapsing/expanding
// parents, and opening the edit form. The view owns its selection locally so
// keypresses never trigger a store-wide re-render.
export function useTreeNavigation(
  tree: TreeNode[],
  itemsPerPage: number,
  detailsReplaceList: boolean,
): TreeNavigation {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [nav, setNav] = useState<NavState>({ selectedIndex: 0, scrollOffset: 0 });

  const modalOpen = useBeadsStore(isModalOpen);
  const selectIssueById = useBeadsStore(state => state.selectIssueById);
  const navigateToEditIssue = useBeadsStore(state => state.navigateToEditIssue);
  const toggleExportDialog = useBeadsStore(state => state.toggleExportDialog);

  const flatNodes = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);

  // Keep the selection in range when the visible set shrinks (filtering, collapsing).
  useEffect(() => {
    setNav(prev => {
      const maxIndex = Math.max(0, flatNodes.length - 1);
      if (prev.selectedIndex <= maxIndex) return prev;
      return { selectedIndex: maxIndex, scrollOffset: 0 };
    });
  }, [flatNodes.length]);

  const scrollFor = (selectedIndex: number, scrollOffset: number): number => {
    if (selectedIndex < scrollOffset) return selectedIndex;
    if (selectedIndex >= scrollOffset + itemsPerPage) return selectedIndex - itemsPerPage + 1;
    return scrollOffset;
  };

  const moveTo = (target: number) =>
    setNav(prev => ({ selectedIndex: target, scrollOffset: scrollFor(target, prev.scrollOffset) }));

  useInput((input, key) => {
    if (modalOpen) return;

    // Functional updates so a held arrow key accumulates every repeat event
    // instead of collapsing them into one step against a stale selectedIndex.
    if ((!detailsReplaceList && key.upArrow) || input === 'k') {
      setNav(prev => {
        if (prev.selectedIndex <= 0) return prev;
        const selectedIndex = prev.selectedIndex - 1;
        return { selectedIndex, scrollOffset: scrollFor(selectedIndex, prev.scrollOffset) };
      });
      return;
    }

    if ((!detailsReplaceList && key.downArrow) || input === 'j') {
      setNav(prev => {
        if (prev.selectedIndex >= flatNodes.length - 1) return prev;
        const selectedIndex = prev.selectedIndex + 1;
        return { selectedIndex, scrollOffset: scrollFor(selectedIndex, prev.scrollOffset) };
      });
      return;
    }

    // Right: expand a collapsed parent, otherwise descend to its first child.
    if ((!detailsReplaceList && key.rightArrow) || input === 'l') {
      const node = flatNodes[nav.selectedIndex];
      if (!node?.hasChildren) return;
      if (node.collapsed) {
        setCollapsed(prev => {
          const next = new Set(prev);
          next.delete(node.issue.id);
          return next;
        });
      } else if (nav.selectedIndex < flatNodes.length - 1) {
        moveTo(nav.selectedIndex + 1);
      }
      return;
    }

    // Left: collapse an expanded parent, otherwise jump to the parent node.
    if ((!detailsReplaceList && key.leftArrow) || input === 'h') {
      const node = flatNodes[nav.selectedIndex];
      if (!node) return;
      if (node.hasChildren && !node.collapsed) {
        setCollapsed(prev => {
          const next = new Set(prev);
          next.add(node.issue.id);
          return next;
        });
      } else if (node.parentId) {
        const parentIndex = flatNodes.findIndex(n => n.issue.id === node.parentId);
        if (parentIndex >= 0) moveTo(parentIndex);
      }
      return;
    }

    // z folds every parent at every depth while any is open, otherwise opens
    // them all. A row the fold hides hands the cursor to its root.
    if (input === 'z' && !key.ctrl) {
      const foldAll = flatNodes.some(n => n.hasChildren && !n.collapsed);
      const next = foldAll ? parentIds(tree) : new Set<string>();
      const targetId = foldAll ? rootIdOf(flatNodes, nav.selectedIndex) : flatNodes[nav.selectedIndex]?.issue.id;
      const target = Math.max(0, flattenTree(tree, next).findIndex(n => n.issue.id === targetId));
      setCollapsed(next);
      moveTo(target);
      return;
    }

    // Edit and export read the store selection, so sync the row under the
    // cursor into it first.
    if (input === 'e' || input === 'x') {
      const issue = flatNodes[nav.selectedIndex]?.issue;
      if (!issue || !selectIssueById(issue.id)) return;
      if (input === 'e') navigateToEditIssue();
      else toggleExportDialog();
    }
  });

  const selectedIndex = Math.min(nav.selectedIndex, Math.max(0, flatNodes.length - 1));
  return {
    flatNodes,
    selectedIndex,
    scrollOffset: nav.scrollOffset,
    selectedIssue: flatNodes[selectedIndex]?.issue,
  };
}
