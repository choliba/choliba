import { THINKING_LINES, ThinkingPanel } from '../../../agents/runs/thinking-panel';

function panelWith(...pieces: readonly string[]): ThinkingPanel {
  const panel = new ThinkingPanel();
  for (const piece of pieces) panel.append(piece);
  return panel;
}

describe('ThinkingPanel', () => {
  it('draws nothing before any reasoning, or for reasoning that is only blank', () => {
    expect(new ThinkingPanel().lines(30)).toEqual([]);
    expect(panelWith('\n\n  ').lines(30)).toEqual([]);
  });

  it('joins the pieces in a frame titled pensando, as tall as THINKING_LINES from the first piece on', () => {
    expect(panelWith(' Vou incluir', ' o CSS').lines(24)).toEqual([
      '┌─ pensando ───────────┐',
      '│ Vou incluir o CSS    │',
      '│                      │',
      '│                      │',
      '│                      │',
      '│                      │',
      '└──────────────────────┘',
    ]);
  });

  it('keeps only the last lines, wrapped to the width and without blank lines between paragraphs', () => {
    const lines = panelWith('um\n\ndois\ntrês\nquatro\ncinco\nseis sete oito').lines(14);

    expect(lines).toHaveLength(THINKING_LINES + 2);
    expect(lines.slice(1, -1)).toEqual([
      '│ três       │',
      '│ quatro     │',
      '│ cinco      │',
      '│ seis sete  │',
      '│ oito       │',
    ]);
  });

  it('starts a thought that follows another one on a line of its own', () => {
    const panel = panelWith('lendo o ticket');
    panel.end();
    panel.append('abrindo a página');

    expect(panel.lines(24).slice(1, 3)).toEqual(['│ lendo o ticket       │', '│ abrindo a página     │']);
  });

  it('keeps a bounded tail of a long reasoning', () => {
    const lines = panelWith('a '.repeat(10_000), 'fim').lines(16);

    expect(lines).toHaveLength(THINKING_LINES + 2);
    expect(lines.at(-2)).toBe('│ fim          │');
  });
});
