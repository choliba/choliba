import { buildTheme } from '@choliba/core/theme';

import { agentRenderOptions, formatProviderLine, renderEvent } from '../../runs/render';

const OPTS = { label: 'echo', colorize: false };

describe('formatProviderLine', () => {
  it('prints the provider id with a provider label prefix', () => {
    expect(formatProviderLine('claude', buildTheme({}, false))).toBe('[provider] claude');
  });

  it('colors the label and the provider each in its theme color', () => {
    const theme = buildTheme({ providers: { claude: 'blue' } }, true);
    expect(formatProviderLine('claude', theme)).toBe('\u001b[35m[provider]\u001b[0m \u001b[34mclaude\u001b[0m');
  });
});

describe('agentRenderOptions', () => {
  it("labels an agent with its name, in CHOL_COLORS' color, else its own, else the default", () => {
    const theme = buildTheme({ agents: { echo: 'gray' } }, true);
    expect(agentRenderOptions('echo', 'red', theme)).toEqual({ label: 'echo', colorize: true, color: 'gray' });
    expect(agentRenderOptions('other', 'red', theme)).toMatchObject({ color: 'red' });
    expect(agentRenderOptions('implementer', undefined, theme)).toMatchObject({ color: 'green' });
    expect(agentRenderOptions('echo', undefined, buildTheme({}, false))).toMatchObject({ colorize: false });
  });
});

describe('renderEvent', () => {
  it('renders init, with the model when known', () => {
    expect(renderEvent({ type: 'init', model: 'sonnet-5', sessionId: 'x' }, OPTS)).toBe('[echo] · ready (sonnet-5)');
  });

  it('renders init without a model', () => {
    expect(renderEvent({ type: 'init', model: undefined, sessionId: undefined }, OPTS)).toBe('[echo] · ready');
  });

  it('renders non-empty text as-is', () => {
    expect(renderEvent({ type: 'text', text: 'hello' }, OPTS)).toBe('[echo] hello');
  });

  it('renders nothing for empty text', () => {
    expect(renderEvent({ type: 'text', text: '' }, OPTS)).toBeUndefined();
  });

  it('renders a tool-call with its summary', () => {
    expect(renderEvent({ type: 'tool-call', id: 't1', name: 'Bash', summary: 'git status' }, OPTS)).toBe(
      '[echo] → Bash: git status',
    );
  });

  it('renders a tool-call with no summary, omitting the colon', () => {
    expect(renderEvent({ type: 'tool-call', id: 't1', name: 'Bash', summary: '' }, OPTS)).toBe('[echo] → Bash');
  });

  it('renders nothing for a successful tool-result', () => {
    expect(
      renderEvent({ type: 'tool-result', id: 't1', name: 'Bash', isError: false, denied: false, text: 'ok' }, OPTS),
    ).toBeUndefined();
  });

  it('renders a failed tool-result with the first line of its text', () => {
    expect(
      renderEvent(
        { type: 'tool-result', id: 't1', name: 'Bash', isError: true, denied: false, text: 'boom\nmore detail' },
        OPTS,
      ),
    ).toBe('[echo] ✗ Bash: boom');
  });

  it('marks a denied tool-result distinctly from any other failure', () => {
    expect(
      renderEvent({ type: 'tool-result', id: 't1', name: 'Bash', isError: true, denied: true, text: 'no' }, OPTS),
    ).toBe('[echo] ✗ Bash (denied): no');
  });

  it('renders an unnamed tool-result with a placeholder name', () => {
    expect(
      renderEvent({ type: 'tool-result', id: 't1', name: undefined, isError: true, denied: false, text: 'no' }, OPTS),
    ).toBe('[echo] ✗ ?: no');
  });

  it('renders a plan event as ready, not the full markdown (that goes to the plan file, not the terminal)', () => {
    expect(renderEvent({ type: 'plan', markdown: '1. a\n2. b' }, OPTS)).toBe('[echo] · plan ready');
  });

  it('renders nothing for a successful done', () => {
    expect(renderEvent({ type: 'done', isError: false, text: 'ok' }, OPTS)).toBeUndefined();
  });

  it('renders a failed done with the first line of its text', () => {
    expect(renderEvent({ type: 'done', isError: true, text: 'failed\ndetail' }, OPTS)).toBe('[echo] ✗ failed');
  });

  it('passes an explicit color through to formatLine', () => {
    const rendered = renderEvent({ type: 'text', text: 'hi' }, { label: 'echo', colorize: true, color: 'magenta' });

    expect(rendered).toBe('\u001b[35m[echo]\u001b[0m hi');
  });
});
