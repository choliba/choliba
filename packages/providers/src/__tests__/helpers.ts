import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NO_PERMISSIONS, type AgentDefinition, type AgentModeSteps, type AgentSections } from '@choliba/domain';
import { ProviderRegistry, type ProviderRequest } from '@choliba/engine';

import { ClaudeAgentProvider, ClaudeOllamaAgentProvider, CodexAgentProvider, CursorAgentProvider } from '../index';

export const claudeProvider = new ClaudeAgentProvider();
export const cursorProvider = new CursorAgentProvider();
export const codexProvider = new CodexAgentProvider();
export const claudeOllamaProvider = new ClaudeOllamaAgentProvider();

export const PROVIDERS = new ProviderRegistry([claudeProvider, codexProvider, cursorProvider]);

const NO_STEPS: AgentModeSteps = { before: [], after: { success: [], failure: [], always: [] } };
export const NO_MODE_STEPS: AgentDefinition['steps'] = { execute: NO_STEPS, plan: NO_STEPS, ask: NO_STEPS };

export function fakeSections(role: string): AgentSections {
  return { role, context: [], input: 'The task.', flow: '1. Do it.', output: 'The result.', notes: [] };
}

export function fakeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'echo',
    id: 'example-echo-agent',
    displayName: 'Echo Agent',
    version: '1.0.0',
    description: 'repeats things',
    providers: [],
    skills: [],
    mcps: [],
    policy: 'read-only',
    taskRequired: true,
    projectRequired: false,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute', 'plan', 'ask'],
    permissions: NO_PERMISSIONS,
    dir: '/repo/agents/echo',
    sections: fakeSections('be an echo'),
    steps: NO_MODE_STEPS,
    sourcePath: '/repo/agents/echo/agent.yaml',
    ...overrides,
  };
}

export function fakeRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    agent: fakeAgent(),
    mode: 'execute',
    policy: 'read-only',
    userPrompt: 'do the task',
    workspaceRoot: '/repo',
    runDir: '/repo/.cache/runs/x',
    addDirs: [],
    model: undefined,
    ...overrides,
  };
}

export function makeTmpDir(prefix: string): { readonly path: string; readonly cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), `${prefix}-`));
  return {
    path,
    cleanup: () => {
      rmSync(path, { recursive: true, force: true });
    },
  };
}
