import { commandPage, commandWords } from '../../help/command-page';

describe('commandWords', () => {
  it('reads the command words of a choliba usage, stopping at the first argument', () => {
    expect(commandWords('choliba run agent')).toEqual(['run', 'agent']);
    expect(commandWords('choliba run agent AGENT [OPTIONS]')).toEqual(['run', 'agent']);
    expect(commandWords('choliba')).toEqual([]);
    expect(commandWords('choliba --help')).toEqual([]);
  });

  it('is undefined for another program', () => {
    expect(commandWords('playwright test')).toBeUndefined();
  });
});

describe('commandPage', () => {
  it('names the reference page, the index for the root, and nothing for another program', () => {
    expect(commandPage('choliba run agent AGENT')).toBe('comandos/run');
    expect(commandPage('choliba list projects')).toBe('comandos/list');
    expect(commandPage('choliba new project NOME')).toBe('comandos/new');
    expect(commandPage('choliba terminal run --label NAME')).toBe('comandos/terminal-run');
    expect(commandPage('choliba add <origem>')).toBe('comandos/add');
    expect(commandPage('choliba help [COMANDO...]')).toBe('comandos/help');
    expect(commandPage('choliba')).toBe('comandos/');
    expect(commandPage('playwright test')).toBeUndefined();
  });
});
