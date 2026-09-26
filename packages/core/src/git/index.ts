export type { GitRunResult, GitRunner } from './git-run';
export { createSpawnGitRunner } from './git-run';
export { DEFAULT_DIFF_BASE, DEFAULT_DIFF_EXCLUDES, getWorkingTreeDiff } from './working-tree-diff';
export type { DiffFileEntry } from './index-diff';
export { indexDiff } from './index-diff';
export type { DocFile, DocsSnapshot } from './docs-snapshot';
export { collectDocsSnapshot } from './docs-snapshot';
export type { CleanBranchesOptions, CleanBranchesResult } from './clean-branches';
export { cleanBranches, DEFAULT_MERGE_TARGET, DEFAULT_PROTECTED_BRANCHES } from './clean-branches';
