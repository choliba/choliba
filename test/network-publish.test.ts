import { Socket } from 'node:net';

import { expect, test } from 'bun:test';

import { pipe } from '../src/network/publish';

test('um erro no cliente destrói o upstream, e só ele', () => {
  const client = new Socket();
  const upstream = new Socket();
  pipe(client, upstream);

  client.emit('error', new Error('cliente caiu'));

  expect(upstream.destroyed).toBe(true);
  expect(client.destroyed).toBe(false);
});

test('um erro no upstream destrói o cliente, e só ele', () => {
  const client = new Socket();
  const upstream = new Socket();
  pipe(client, upstream);

  upstream.emit('error', new Error('upstream caiu'));

  expect(client.destroyed).toBe(true);
  expect(upstream.destroyed).toBe(false);
});
