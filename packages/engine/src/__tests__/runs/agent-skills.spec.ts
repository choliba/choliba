import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatSkillsInstruction, listSkills, resolveSkills, skillDescription } from '../../runs/agent-skills';
import { makeTmpDir } from '../helpers/tmp';

const SKILLS = join(__dirname, '..', 'fixtures', 'skills');

describe('skillDescription', () => {
  it('reads the description from the YAML frontmatter', () => {
    expect(skillDescription('---\nname: x\ndescription: "  Does x.  "\n---\n# X\n', 'x.md')).toBe('Does x.');
    expect(skillDescription('---\r\ndescription: Windows.\r\n---\r\n', 'x.md')).toBe('Windows.');
  });

  it('rejects a file without frontmatter, with invalid YAML, or without a description', () => {
    expect(() => skillDescription('# X\n', 'x.md')).toThrow('x.md: sem frontmatter YAML');
    expect(() => skillDescription('---\ndescription: [unclosed\n---\n', 'x.md')).toThrow('frontmatter YAML inválido');
    expect(() => skillDescription('---\nname: x\n---\n', 'x.md')).toThrow('falta "description"');
    expect(() => skillDescription('---\ndescription: "   "\n---\n', 'x.md')).toThrow('falta "description"');
    expect(() => skillDescription('---\n- a list\n---\n', 'x.md')).toThrow('falta "description"');
  });
});

describe('resolveSkills', () => {
  it('finds each listed skill as <skillsDir>/<name>/SKILL.md, with how the agent uses it', () => {
    const skill = {
      name: 'dummy-skill',
      description: 'Skill de teste, usada pelo agente echo das fixtures.',
      path: join(SKILLS, 'dummy-skill', 'SKILL.md'),
    };
    expect(resolveSkills(SKILLS, [{ name: 'dummy-skill' }])).toEqual([skill]);
    expect(resolveSkills(SKILLS, [{ name: 'dummy-skill', instructions: 'Use.' }])).toEqual([
      { ...skill, instructions: 'Use.' },
    ]);
    expect(resolveSkills(SKILLS, [])).toEqual([]);
  });

  it('fails naming the missing file', () => {
    expect(() => resolveSkills(SKILLS, [{ name: 'nope' }])).toThrow(
      `skill "nope" não encontrada: ${join(SKILLS, 'nope', 'SKILL.md')} não existe.`,
    );
  });
});

describe('listSkills', () => {
  it('lists each folder that has a SKILL.md, sorted, with its description', () => {
    const tmp = makeTmpDir('skills');
    try {
      for (const [name, description] of [
        ['zeta', 'Last.'],
        ['alpha', 'First.'],
      ] as const) {
        mkdirSync(join(tmp.path, name));
        writeFileSync(join(tmp.path, name, 'SKILL.md'), `---\ndescription: ${description}\n---\n`);
      }
      mkdirSync(join(tmp.path, 'not-a-skill'));
      writeFileSync(join(tmp.path, 'README.md'), '# not a skill\n');

      expect(listSkills(tmp.path)).toEqual([
        { name: 'alpha', description: 'First.', path: join(tmp.path, 'alpha', 'SKILL.md') },
        { name: 'zeta', description: 'Last.', path: join(tmp.path, 'zeta', 'SKILL.md') },
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it('has none in a missing or empty folder', () => {
    const tmp = makeTmpDir('skills');
    try {
      expect(listSkills(tmp.path)).toEqual([]);
      expect(listSkills(join(tmp.path, 'missing'))).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });

  it('fails naming a SKILL.md without a description', () => {
    const tmp = makeTmpDir('skills');
    try {
      mkdirSync(join(tmp.path, 'broken'));
      writeFileSync(join(tmp.path, 'broken', 'SKILL.md'), '# no frontmatter\n');

      expect(() => listSkills(tmp.path)).toThrow(`${join(tmp.path, 'broken', 'SKILL.md')}: sem frontmatter YAML`);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('formatSkillsInstruction', () => {
  it('orders each skill read by path, from the repo root when inside it', () => {
    const instruction = formatSkillsInstruction(
      [
        { name: 'docs', description: 'Writes docs.', path: '/repo/.choliba/skills/docs/SKILL.md' },
        { name: 'ext', description: 'Elsewhere.', path: '/other/skills/ext/SKILL.md' },
      ],
      '/repo',
    );

    expect(instruction.split('\n')).toEqual([
      'Utilize a skill docs: leia `.choliba/skills/docs/SKILL.md` antes de qualquer outra coisa e siga-a durante toda a tarefa.',
      'Utilize a skill ext: leia `/other/skills/ext/SKILL.md` antes de qualquer outra coisa e siga-a durante toda a tarefa.',
      'Esses caminhos partem da raiz do repositório. Abra os arquivos que uma skill indicar (ex.: references/) só quando ela mandar.',
    ]);
    expect(formatSkillsInstruction([], '/repo')).toBe('');
  });

  it('follows the order to read a skill with how this agent uses it, when agent.yaml says', () => {
    const instruction = formatSkillsInstruction(
      [
        {
          name: 'cli',
          description: 'Browser.',
          path: '/repo/s/cli/SKILL.md',
          instructions: 'Rode bunx choliba cli.\n',
        },
      ],
      '/repo',
    );

    expect(instruction.split('\n').slice(1, 4)).toEqual([
      '<skill_instructions name="cli">',
      'Rode bunx choliba cli.',
      '</skill_instructions>',
    ]);
  });
});
