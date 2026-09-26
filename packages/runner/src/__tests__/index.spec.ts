import * as playwright from '../index';

describe('playwright package entrypoint', () => {
  it('re-exports the public API', () => {
    expect(typeof playwright.flattenResults).toBe('function');
    expect(typeof playwright.isRealFailure).toBe('function');
    expect(typeof playwright.fillTicketTests).toBe('function');
    expect(typeof playwright.runTestsCli).toBe('function');
  });
});
