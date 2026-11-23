/**
 * The project's tools the pages know: tools/*.ts (at the project's root), read as text by
 * Vite when the pages are built (never run).
 */

import { toolsOfFiles, type ProjectTool } from './project-tools';

/** Every registered tool of the project. */
export const PROJECT_TOOLS: readonly ProjectTool[] = toolsOfFiles(
  import.meta.glob<string>('../../../../tools/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/** The project's tool a name (`choliba/…`) is, if any. */
export const projectTool = (name: string): ProjectTool | undefined =>
  PROJECT_TOOLS.find((tool) => tool.name === name);
