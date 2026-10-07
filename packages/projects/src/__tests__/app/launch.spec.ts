import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { answers, launchApp } from '../../app/launch';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function until(check: () => boolean): Promise<void> {
  for (let tries = 0; tries < 100 && !check(); tries += 1) await wait(50);
}

describe('launchApp', () => {
  it('runs the command in its folder, logs its output, and tells when it ended', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'launch-app-'));
    try {
      const log = join(dir, 'logs', 'demo.log');
      mkdirSync(join(dir, 'logs'));
      writeFileSync(log, 'an earlier run\n');
      const app = launchApp('pwd; echo boom >&2; exit 3', dir, log, process.env);

      await until(() => app.exitCode() !== undefined);

      expect(app.exitCode()).toBe(3);
      expect(readFileSync(log, 'utf8')).toBe(`${dir}\nboom\n`);
      app.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stops the whole process group, what the command started included', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'launch-app-'));
    try {
      const app = launchApp('sleep 30 & sleep 30', dir, join(dir, 'app.log'), process.env);
      await wait(100);
      expect(app.exitCode()).toBeUndefined();

      app.stop();
      await until(() => app.exitCode() !== undefined);

      expect(app.exitCode()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('launchApp, when the server does not cooperate', () => {
  it('kills a server that ignores SIGTERM once the grace time is over', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'launch-app-'));
    try {
      const app = launchApp("trap '' TERM; sleep 30", dir, join(dir, 'app.log'), process.env, 100);
      await wait(100);

      app.stop();
      await wait(50);
      expect(app.exitCode()).toBeUndefined();
      await until(() => app.exitCode() !== undefined);

      expect(app.exitCode()).toBeNull();
      app.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ends at once with code 127 when it cannot even start', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'launch-app-'));
    try {
      const app = launchApp('true', join(dir, 'missing'), join(dir, 'app.log'), process.env);

      await until(() => app.exitCode() !== undefined);

      expect(app.exitCode()).toBe(127);
      // Nothing to stop: there is no process group, on the way out or otherwise.
      process.emit('exit', 0);
      app.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stops the server when choliba exits without stopping it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'launch-app-'));
    try {
      const app = launchApp('sleep 30', dir, join(dir, 'app.log'), process.env);
      await wait(100);

      process.emit('exit', 0);
      await until(() => app.exitCode() !== undefined);

      expect(app.exitCode()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('answers', () => {
  it('is true for any HTTP response and false when nothing listens', async () => {
    const server = createServer((_request, response) => {
      response.statusCode = 500;
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    try {
      expect(await answers(`http://127.0.0.1:${String(port)}/`)).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    expect(await answers(`http://127.0.0.1:${String(port)}/`)).toBe(false);
  });
});
