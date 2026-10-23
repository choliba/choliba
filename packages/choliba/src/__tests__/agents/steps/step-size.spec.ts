import {
  checkSectionSize,
  DEFAULT_MAX_SIZE,
  formatSize,
  parseMaxSize,
} from '../../../../../engine/src/steps/step-size';

describe('parseMaxSize', () => {
  it('reads bytes with B, KB or MB in any case, bytes with no unit, and the default when absent', () => {
    expect([parseMaxSize('512'), parseMaxSize('512B'), parseMaxSize('40KB'), parseMaxSize(' 2 mb ')]).toEqual([
      512,
      512,
      40 * 1024,
      2 * 1024 * 1024,
    ]);
    expect([parseMaxSize(''), parseMaxSize('  ')]).toEqual([DEFAULT_MAX_SIZE, DEFAULT_MAX_SIZE]);
  });

  it('is NaN for what is not a size', () => {
    expect([parseMaxSize('40 GB'), parseMaxSize('muito')]).toEqual([Number.NaN, Number.NaN]);
  });
});

describe('formatSize', () => {
  it('writes bytes, kilobytes and megabytes for a person, with a comma', () => {
    expect([formatSize(512), formatSize(40 * 1024), formatSize(1536), formatSize(3.1 * 1024 * 1024)]).toEqual([
      '512 B',
      '40 KB',
      '1,5 KB',
      '3,1 MB',
    ]);
  });
});

describe('checkSectionSize', () => {
  it('lets a section within the limit through, and stops a larger one saying what to do', () => {
    expect(() => {
      checkSectionSize('t', 1024, 1024, 3);
    }).not.toThrow();
    expect(() => {
      checkSectionSize('t', 2048, 1024, 3);
    }).toThrow(
      'a seção <t> tem 2 KB e o limite (max_size) é 1 KB: 3 arquivo(s) encontrado(s).\n' +
        'Estreite o pattern, acrescente pastas ao ignore ou aumente o max_size.',
    );
  });
});
