import { UsageError } from '../../new/new-options';
import { defaultsPrompter } from '../../new/prompter';

describe('defaultsPrompter', () => {
  it('takes the default of each question', async () => {
    expect(await defaultsPrompter.text('Pasta?', 'PASTA', 'choliba')).toBe('choliba');
    expect(await defaultsPrompter.select('Provider?', [{ value: 'a', label: 'A' }], 'a')).toBe('a');
    expect(await defaultsPrompter.multiselect('Agentes?', [{ value: 'a', label: 'A' }], ['a'])).toEqual(['a']);
  });

  it('fails naming the flag when a question has no default', async () => {
    await expect(defaultsPrompter.text('Onde?', '--mcp-app-dir')).rejects.toThrow(UsageError);
    await expect(defaultsPrompter.text('Onde?', '--mcp-app-dir')).rejects.toThrow(
      'sem perguntas, --mcp-app-dir é obrigatório (Onde?).',
    );
  });
});
