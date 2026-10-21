import { Container, token } from '../..';

describe('Container', () => {
  it('builds a value on the first get and reuses it', () => {
    const container = new Container();
    const counter = token<{ readonly id: number }>('counter');
    let built = 0;
    container.provide(counter, () => ({ id: ++built }));

    expect(built).toBe(0);
    expect(container.get(counter)).toEqual({ id: 1 });
    expect(container.get(counter)).toBe(container.get(counter));
    expect(built).toBe(1);
  });

  it('builds a value from the others it depends on', () => {
    const container = new Container();
    const name = token<string>('name');
    const greeting = token<string>('greeting');
    container.provide(greeting, (c) => `olá, ${c.get(name)}`);
    container.provide(name, () => 'choliba');

    expect(container.get(greeting)).toBe('olá, choliba');
  });

  it('refuses a token registered twice', () => {
    const container = new Container();
    const twice = token<number>('twice');
    container.provide(twice, () => 1);

    expect(() => {
      container.provide(twice, () => 2);
    }).toThrow('twice já está registrado no container.');
  });

  it('says which token has nothing registered', () => {
    expect(() => new Container().get(token<number>('missing'))).toThrow('nada registrado no container para missing.');
  });

  it('names the whole cycle when values depend on each other', () => {
    const container = new Container();
    const a = token<number>('a');
    const b = token<number>('b');
    container.provide(a, (c) => c.get(b));
    container.provide(b, (c) => c.get(a));

    expect(() => container.get(a)).toThrow('dependência circular no container: a → b → a.');
  });

  it('builds again after a failed build, as nothing was kept', () => {
    const container = new Container();
    const flaky = token<string>('flaky');
    let calls = 0;
    container.provide(flaky, () => {
      calls += 1;
      if (calls === 1) throw new Error('primeira falhou');
      return 'ok';
    });

    expect(() => container.get(flaky)).toThrow('primeira falhou');
    expect(container.get(flaky)).toBe('ok');
  });

  it('lets a spec put a value in place of a registered or unknown token', () => {
    const container = new Container();
    const service = token<string>('service');
    container.provide(service, () => 'real');
    container.override(service, 'fake');
    const other = token<number>('other');
    container.override(other, 7);

    expect(container.get(service)).toBe('fake');
    expect(container.get(other)).toBe(7);
  });
});
