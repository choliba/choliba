import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parseAgentYaml } from '@choliba/agents';

import { createAgent, type CreateAgentDeps, formatCreatedAgent } from '../../agent/create-agent';
import { UsageError, WorkspaceError } from '../../new/new-options';
import { defaultsPrompter, type Prompter } from '../../new/prompter';

interface Scene {
  readonly root: string;
  readonly calls: string[];
  readonly said: string[];
  readonly deps: CreateAgentDeps;
}

function scene(prompter: Prompter = defaultsPrompter, checkCode = 0): Scene {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-cli-agent-'));
  const calls: string[] = [];
  const said: string[] = [];
  const deps: CreateAgentDeps = {
    root,
    prompter,
    say: (line) => said.push(line),
    run: (command, args, cwd) => {
      calls.push(`${cwd === root ? '.' : cwd}$ ${[command, ...args].join(' ')}`);
      return checkCode;
    },
  };
  return { root, calls, said, deps };
}

const FULL = { name: 'revisor', description: 'Revisa', role: 'Você revisa.', noInput: true } as const;

describe('createAgent', () => {
  it('writes a valid agent.yaml in .choliba/agents and checks the workspace', async () => {
    const s = scene();
    try {
      const agent = await createAgent(FULL, s.deps);

      const file = path.join(s.root, '.choliba', 'agents', 'revisor', 'agent.yaml');
      expect(agent).toEqual({ name: 'revisor', file, project: true, checked: true });
      const parsed = parseAgentYaml(readFileSync(file, 'utf8'), file, 'revisor');
      expect(parsed.supportedModels).toEqual(['claude-sonnet-5', 'Auto']);
      expect(readFileSync(file, 'utf8')).toContain("read: ['${APP_DIR}/', '${PROJECT_DIR}/tests/']");
      expect(s.calls).toEqual(['.$ bunx choliba check']);
      expect(s.said).toEqual([`agente criado: ${file}`, 'conferindo: bunx choliba check']);
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('asks what the options do not say', async () => {
    const asked: string[] = [];
    const answers: Readonly<Record<string, string>> = {
      NOME: 'perguntado',
      '--description': 'Faz algo',
      '--role': 'Você faz algo.',
      '--models': ' m1 , ,m2',
    };
    const prompter: Prompter = {
      text: (question, flag) => {
        asked.push(question);
        return Promise.resolve(answers[flag] ?? '');
      },
      select: (question, choices) => {
        asked.push(`${question} ${choices.map((choice) => choice.value).join('|')}`);
        const last = choices.at(-1);
        if (last === undefined) throw new Error('escolhas esperadas');
        return Promise.resolve(last.value);
      },
      multiselect: () => Promise.reject(new Error('sem multiselect')),
    };
    const s = scene(prompter, 1);
    try {
      const agent = await createAgent({ noInput: false }, s.deps);

      expect(agent).toMatchObject({ name: 'perguntado', checked: false });
      expect(asked).toEqual([
        'Nome do agente (a pasta e o comando)?',
        'O que ele faz, numa frase (a descrição)?',
        'Quem ele é, numa frase (o papel)?',
        'Com que modelos ele roda (separados por vírgula)?',
        'Ele age sobre um projeto (--project)? sim|nao',
      ]);
      const text = readFileSync(agent.file, 'utf8');
      expect(parseAgentYaml(text, agent.file, 'perguntado').supportedModels).toEqual(['m1', 'm2']);
      expect(text).not.toContain('permissions:');
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('asks what it may do on the project, unless --access says it', async () => {
    const asked: string[] = [];
    const prompter: Prompter = {
      ...defaultsPrompter,
      select: (question, choices, fallback) => {
        asked.push(question);
        const yes = choices.find((choice) => choice.value === 'sim');
        return Promise.resolve(yes === undefined ? fallback : yes.value);
      },
    };
    const s = scene(prompter);
    try {
      await createAgent({ ...FULL, name: 'a' }, s.deps);
      await createAgent({ ...FULL, name: 'b', access: 'testes' }, s.deps);
      await createAgent({ ...FULL, name: 'c', project: false }, s.deps);
      await createAgent({ ...FULL, name: 'd', project: true, access: 'escrita' }, s.deps);
      expect(asked).toEqual([
        'Ele age sobre um projeto (--project)?',
        'O que ele pode fazer no projeto?',
        'Ele age sobre um projeto (--project)?',
      ]);
      const b = readFileSync(path.join(s.root, '.choliba', 'agents', 'b', 'agent.yaml'), 'utf8');
      expect(b).toContain('bunx choliba tests ${PROJECT}/tests');
      const yaml = (name: string): string =>
        readFileSync(path.join(s.root, '.choliba', 'agents', name, 'agent.yaml'), 'utf8');
      expect(yaml('c')).not.toContain('permissions:');
      expect(yaml('d')).toContain("write: ['${APP_DIR}/']");
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });

  it('never touches an agent that exists, and names the flag a missing answer needs', async () => {
    const s = scene();
    try {
      mkdirSync(path.join(s.root, '.choliba', 'agents', 'revisor'), { recursive: true });
      const existing = createAgent(FULL, s.deps);
      await expect(existing).rejects.toThrow(WorkspaceError);
      await expect(createAgent(FULL, s.deps)).rejects.toThrow('o agente revisor já existe');
      await expect(createAgent({ name: 'x', noInput: true }, s.deps)).rejects.toThrow(UsageError);
      await expect(createAgent({ noInput: true }, s.deps)).rejects.toThrow('sem perguntas, NOME é obrigatório');
      expect(s.calls).toEqual([]);
    } finally {
      rmSync(s.root, { recursive: true, force: true });
    }
  });
});

describe('formatCreatedAgent', () => {
  it('says where the agent is, what to write in it and how to try it', () => {
    const ok = formatCreatedAgent({ name: 'revisor', file: '/ws/agent.yaml', project: true, checked: true });
    expect(ok).toContain('Agente revisor criado: /ws/agent.yaml');
    expect(ok).toContain('Troque os CHANGE_ME');
    expect(ok).toContain('bunx choliba revisor --project PROJETO --dry-run --show-prompt "a tarefa"');
    const alone = formatCreatedAgent({ name: 'r', file: '/f', project: false, checked: false });
    expect(alone).toContain('apontou o que corrigir');
    expect(alone).toContain('bunx choliba r --dry-run --show-prompt "a tarefa"');
  });
});
