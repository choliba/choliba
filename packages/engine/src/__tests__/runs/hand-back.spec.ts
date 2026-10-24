import { handBackOf } from '../../runs/hand-back';

const AGENTS = ['product-owner', 'test-writer', 'implementer'];

describe('handBackOf', () => {
  it('reads the agent and why from the last hand-back line, bare, in backticks or in bold', () => {
    expect(handBackOf('parei.\nHand back to: product-owner — o CA-01 não é testável', 'test-writer', AGENTS)).toEqual({
      agent: 'product-owner',
      why: 'o CA-01 não é testável',
    });
    expect(handBackOf('**Hand back to:** `product-owner`: falta o critério', 'test-writer', AGENTS)).toEqual({
      agent: 'product-owner',
      why: 'falta o critério',
    });
    expect(handBackOf('Hand back to: implementer - x\nhand back to: Product-Owner', 'test-writer', AGENTS)).toEqual({
      agent: 'product-owner',
      why: '',
    });
  });

  it('hands back to nobody for itself, an agent outside the session, or no such line', () => {
    expect(handBackOf('Hand back to: test-writer — eu', 'test-writer', AGENTS)).toBeUndefined();
    expect(handBackOf('Hand back to: outro — x', 'test-writer', AGENTS)).toBeUndefined();
    expect(handBackOf('o ticket é trabalho do product-owner', 'test-writer', AGENTS)).toBeUndefined();
    expect(handBackOf(undefined, 'test-writer', AGENTS)).toBeUndefined();
  });
});
