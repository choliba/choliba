import type { Access } from './agent-options';

/** What the assistant knows about a new agent; the rest of its text is for the person to write. */
export interface AgentSpec {
  readonly name: string;
  readonly description: string;
  readonly role: string;
  readonly models: readonly string[];
  readonly project: boolean;
  readonly access: Access;
}

/** A YAML scalar that reads back as `text`, whatever it holds: JSON strings are valid YAML. */
function scalar(text: string): string {
  return JSON.stringify(text);
}

/** The `permissions` of each access, on the project's variables (choliba fills them in on every run). */
function permissions(access: Access): readonly string[] {
  if (access === 'nada') return [];
  const read = ['permissions:', '  allow:', "    read: ['${APP_DIR}/', '${PROJECT_DIR}/tests/']"];
  if (access === 'leitura') return read;
  const write = [...read, "    write: ['${APP_DIR}/']"];
  const execute =
    access === 'testes' ? ['    execute:', "      '${CHOL_ROOT}/': ['bunx choliba tests ${PROJECT}/tests']"] : [];
  return [...write, ...execute, '  deny:', "    write: ['${PROJECT_DIR}/']"];
}

function title(name: string): string {
  return name
    .split(/[-_]/)
    .filter((part) => part !== '')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

/**
 * The `agent.yaml` of a new agent: valid as it is (`choliba check` passes), with what the assistant asked filled
 * in and `CHANGE_ME` where the person writes the agent's text (input, flow, output). Every key is the standard 1
 * one; `docs/guias/escrever-um-agente.md` explains each.
 */
export function agentYaml(spec: AgentSpec): string {
  const project = spec.project ? ['  Age sobre o projeto `${PROJECT}`, cuja aplicação fica em `${APP_DIR}`.'] : [];
  return [
    'version: 1',
    '',
    'agent:',
    `  id: ${spec.name}`,
    `  name: ${scalar(title(spec.name))}`,
    '  version: 0.1.0',
    `  description: ${scalar(spec.description)}`,
    '',
    'models:',
    ...spec.models.map((model) => `  - ${scalar(model)}`),
    '',
    '# O texto do agente: o que ele é, o que recebe, como trabalha e o que entrega. Troque cada CHANGE_ME.',
    'role: |',
    `  ${spec.role}`,
    ...project,
    'input: |',
    '  CHANGE_ME: o que o agente recebe (a tarefa, um ticket, arquivos).',
    'flow: |',
    '  1. CHANGE_ME: o primeiro passo.',
    '  2. CHANGE_ME: o próximo.',
    'output: |',
    '  CHANGE_ME: o que o agente entrega no fim (arquivos, uma resposta).',
    '',
    ...permissions(spec.access),
    '',
  ].join('\n');
}
