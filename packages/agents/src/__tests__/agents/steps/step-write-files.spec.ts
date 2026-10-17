import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { answerContent, writeFiles } from '../../../agents/steps/step-write-files';
import { makeTmpDir } from '../../helpers/tmp';

describe('answerContent', () => {
  it('takes out a code block that wraps the whole answer, with or without a language', () => {
    expect(answerContent('```markdown\n# Título\n\n- item\n```')).toBe('# Título\n\n- item\n');
    expect(answerContent('  ```\nsó isto\n```  \n')).toBe('só isto\n');
  });

  it('keeps an answer as it came when no block wraps all of it, ending it with one line break', () => {
    expect(answerContent('# Título\n\n```ts\nconst a = 1;\n```\n\nfim\n\n')).toBe(
      '# Título\n\n```ts\nconst a = 1;\n```\n\nfim\n',
    );
  });
});

describe('writeFiles', () => {
  it('saves the answer to each file, relative to the workspace or absolute, making folders and replacing', () => {
    const repo = makeTmpDir('write-files-repo');
    const elsewhere = makeTmpDir('write-files-elsewhere');
    try {
      mkdirSync(join(repo.path, 'docs'));
      writeFileSync(join(repo.path, 'docs', 'stack.md'), 'antiga');

      writeFiles(repo.path, '```markdown\nnova\n```', ['docs/stack.md', join(elsewhere.path, 'a', 'b.md')]);

      expect(readFileSync(join(repo.path, 'docs', 'stack.md'), 'utf8')).toBe('nova\n');
      expect(readFileSync(join(elsewhere.path, 'a', 'b.md'), 'utf8')).toBe('nova\n');
    } finally {
      repo.cleanup();
      elsewhere.cleanup();
    }
  });

  it('fails with no answer, or a blank one, writing nothing', () => {
    const repo = makeTmpDir('write-files-none');
    try {
      expect(() => {
        writeFiles(repo.path, undefined, ['x.md']);
      }).toThrow('o agente não deu resposta para gravar');
      expect(() => {
        writeFiles(repo.path, ' \n', ['x.md']);
      }).toThrow('o agente não deu resposta para gravar');
    } finally {
      repo.cleanup();
    }
  });
});
