import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Container, type PanelContext } from '@choliba/core';
import { fakeChatPanel } from '@choliba/core/testing';

import { projectsPanel } from '../../projects/projects-panel';
import { PROJECTS } from '../../projects/projects.constants';
import { ProjectsService } from '../../projects/projects.service';
import type { LocationsService } from '../../locations';

/** A projects folder with `projects` (name → its files), and the panel's commands on it. */
function withProjects(projects: Readonly<Record<string, Readonly<Record<string, string>>>>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-panel-'));
  for (const [name, files] of Object.entries(projects)) {
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, name, file), content);
    }
  }
  const container = new Container();
  const locations = { projectsDir: () => dir } as unknown as LocationsService;
  container.provide(PROJECTS, () => new ProjectsService(locations));
  const values = new Map<string, string>();
  const context: PanelContext = {
    get: (key) => values.get(key),
    set: (key, value) => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
    show: (title, card) => {
      shown.push([title, card?.lines, card?.summary]);
      keys.push(card?.key);
    },
    label: () => undefined,
    status: () => undefined,
    onKey: () => undefined,
    converse: () => undefined,
    busy: () => undefined,
    clear: () => undefined,
    quit: () => Promise.resolve(),
    onChange: () => undefined,
    spin: () => undefined,
  };
  const shown: [string, readonly string[] | undefined, readonly string[] | undefined][] = [];
  const keys: (string | undefined)[] = [];
  const fake = fakeChatPanel();
  const [projectsCommand, ticketsCommand] = projectsPanel;
  if (projectsCommand === undefined || ticketsCommand === undefined) throw new Error('commands');
  return {
    fake,
    values,
    shown,
    keys,
    container,
    projects: () => projectsCommand.run({ container, panel: fake.panel, context }),
    tickets: () => ticketsCommand.run({ container, panel: fake.panel, context }),
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

const LOJA = {
  'config.json': JSON.stringify({
    name: 'Loja',
    description: 'Loja de exemplo',
    envs: [{ nome: 'local', baseURL: 'http://localhost:5173/', appDir: '/code/loja' }],
  }),
  '.env.json': JSON.stringify({ local: {} }),
  'tickets/1.json': JSON.stringify({
    titulo: 'Carrinho',
    criterios: [
      { id: 'CA-01', descricao: ['Dado um produto', 'Quando adiciono'], testes: ['carrinho.spec.ts › adiciona'] },
      { id: 'CA-02', descricao: [] },
    ],
  }),
  'tickets/2.json': '{}',
};

describe('the panel commands of @choliba/projects', () => {
  it('names /projects and /tickets', () => {
    expect(projectsPanel.map((command) => [command.name, command.description])).toEqual([
      ['projects', 'Escolhe o projeto em que o painel age'],
      ['tickets', 'Escolhe o ticket do projeto ativo'],
    ]);
  });

  it('chooses the active project, marking the current one, clears the ticket when it changes, and asks for one', async () => {
    const panel = withProjects({ blog: { 'config.json': '{}' }, loja: LOJA });
    try {
      panel.values.set('ticket', 'blog-1');
      panel.fake.answer(1);
      await panel.projects();

      expect(panel.fake.choices[0]).toEqual({
        title: 'Escolha o projeto',
        description: 'O projeto em que os tickets, os testes e os agentes vão agir.',
        options: [
          { label: 'blog', detail: '', current: false },
          { label: 'loja', detail: 'Loja de exemplo', current: false },
        ],
      });
      expect(panel.fake.choices[1]?.title).toBe('Escolha o ticket de loja');
      expect([...panel.values]).toEqual([
        ['projeto', 'loja'],
        ['descrição', 'Loja de exemplo'],
        ['ticket', 'loja-2'],
      ]);
      expect(panel.shown[0]).toEqual([
        'projeto',
        [
          '\u001b[1m\u001b[36mloja\u001b[39m\u001b[22m',
          '---',
          'Loja de exemplo',
          '\u001b[90mlocal · http://localhost:5173/\u001b[39m',
          '---',
          '2 tickets',
        ],
        [
          '\u001b[1m\u001b[36mloja\u001b[39m\u001b[22m',
          '2 tickets \u001b[90m· local\u001b[39m',
          '\u001b[90mlocalhost:5173\u001b[39m',
        ],
      ]);
      expect(panel.fake.written[0]).toBe('Projeto \u001b[1mloja\u001b[22m selecionado.');

      panel.values.set('ticket', 'loja-1');
      await panel.projects();
      expect(panel.fake.choices[2]?.options[1]?.current).toBe(true);
      expect(panel.values.get('ticket')).toBe('loja-1');

      panel.fake.answer(0);
      await panel.projects();
      expect([panel.values.get('projeto'), panel.values.has('ticket'), panel.fake.choices.length]).toEqual([
        'blog',
        false,
        4,
      ]);

      panel.fake.answer(undefined);
      await panel.projects();
      expect(panel.values.get('projeto')).toBe('blog');
    } finally {
      panel.cleanup();
    }
  });

  it('shows a card of a project with no description, settings or more than one ticket as it is', async () => {
    const panel = withProjects({ blog: { 'config.json': '{}', 'tickets/1.json': '{}' } });
    try {
      await panel.projects();

      expect(panel.shown[0]?.[1]).toEqual([
        '\u001b[1m\u001b[36mblog\u001b[39m\u001b[22m',
        '---',
        '\u001b[90msem descrição\u001b[39m',
        '\u001b[33mconfiguração incompleta: choliba check blog\u001b[39m',
        '---',
        '1 ticket',
      ]);
    } finally {
      panel.cleanup();
    }
  });

  it('says there is no project to choose', async () => {
    const panel = withProjects({});
    try {
      await panel.projects();

      expect(panel.fake.written).toEqual(['Nenhum projeto na pasta de projetos. Crie um com `choliba new project`.']);
      expect(panel.fake.choices).toEqual([]);
    } finally {
      panel.cleanup();
    }
  });

  it('chooses the ticket of the active project and writes its summary', async () => {
    const panel = withProjects({ loja: LOJA });
    try {
      panel.values.set('projeto', 'loja');
      panel.values.set('ticket', 'loja-2');
      await panel.tickets();
      expect(panel.shown[0]?.[1]?.slice(1)).toEqual([
        '---',
        '\u001b[90msem descrição\u001b[39m',
        '\u001b[90mlocal · http://localhost:5173/\u001b[39m',
        '---',
        '2 tickets · ativo \u001b[1mloja-1\u001b[22m',
      ]);
      expect(panel.shown[0]?.[2]).toEqual([
        '\u001b[1m\u001b[36mloja\u001b[39m\u001b[22m · ativo \u001b[1mloja-1\u001b[22m',
        '2 tickets \u001b[90m· local\u001b[39m',
        '\u001b[90mlocalhost:5173\u001b[39m',
      ]);
      panel.values.set('descrição', 'Loja de exemplo');

      expect(panel.fake.choices[0]).toEqual({
        title: 'Escolha o ticket de loja',
        description: 'O ticket em que os testes e os agentes vão agir. Esc deixa como está.',
        options: [
          { label: 'loja-1', detail: 'Carrinho', current: false },
          { label: 'loja-2', current: true },
        ],
      });
      expect(panel.values.get('ticket')).toBe('loja-1');
      expect(panel.fake.written).toEqual([
        [
          'Ticket \u001b[1mloja-1\u001b[22m selecionado.',
          '\u001b[1mloja-1\u001b[22m Carrinho',
          '  \u001b[32m✔\u001b[39m CA-01 Dado um produto',
          '  \u001b[90m·\u001b[39m CA-02 ',
          '\u001b[90m1 de 2 critérios com teste.\u001b[39m',
        ].join('\n'),
      ]);

      panel.fake.answer(1);
      await panel.tickets();
      expect(panel.fake.written[1]).toBe(
        [
          'Ticket \u001b[1mloja-2\u001b[22m selecionado.',
          '\u001b[1mloja-2\u001b[22m',
          '\u001b[90m0 de 0 critérios com teste.\u001b[39m',
        ].join('\n'),
      );

      panel.fake.answer(undefined);
      await panel.tickets();
      expect(panel.values.get('ticket')).toBe('loja-2');
    } finally {
      panel.cleanup();
    }
  });

  it('is unavailable with no active project or no ticket in it, saying which', async () => {
    const panel = withProjects({ blog: { 'config.json': '{}' }, loja: LOJA });
    try {
      const tickets = projectsPanel[1];
      const context = {
        get: (key: string) => panel.values.get(key),
        set: () => undefined,
        show: () => undefined,
        label: () => undefined,
        status: () => undefined,
        onKey: () => undefined,
        converse: () => undefined,
        busy: () => undefined,
        clear: () => undefined,
        quit: () => Promise.resolve(),
        onChange: () => undefined,
        spin: () => undefined,
      };
      expect(tickets?.unavailable?.(context, panel.container)).toBe('Escolha um projeto antes, com /projects');
      await panel.tickets();

      panel.values.set('projeto', 'blog');
      expect(tickets?.unavailable?.(context, panel.container)).toBe('O projeto blog ainda não tem tickets');
      await panel.tickets();
      expect(panel.fake.written).toEqual(['O projeto blog ainda não tem tickets.']);

      panel.values.set('projeto', 'loja');
      expect(tickets?.unavailable?.(context, panel.container)).toBeUndefined();
    } finally {
      panel.cleanup();
    }
  });
});
