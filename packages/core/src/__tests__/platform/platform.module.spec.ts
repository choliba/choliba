import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
  ARGV,
  CLOCK,
  CWD,
  ENV,
  GIT,
  NO_COLOR_FLAG,
  rawArgsAfter,
  takeGlobalFlags,
  SIGNALS,
  SPAWN,
  STDERR,
  STDOUT,
  WHICH,
  type Platform,
} from '../../platform';
import { ExitStatus, PlatformModule } from '../../nest';
import { fakePlatform } from '../../testing';

@Injectable()
class Consumer {
  constructor(@Inject(CWD) readonly cwd: string) {}
}

/** A feature module that does not import PlatformModule: the values reach it because forRoot is global. */
@Module({ providers: [Consumer], exports: [Consumer] })
class FeatureModule {}

describe('PlatformModule.forRoot', () => {
  it('provides every value of the platform under its own token', async () => {
    const platform: Platform = fakePlatform({ argv: ['x'], cwd: '/work', env: { A: '1' }, noColorFlag: true });
    const moduleRef = await Test.createTestingModule({ imports: [PlatformModule.forRoot(platform)] }).compile();

    expect(moduleRef.get(ARGV)).toEqual(['x']);
    expect(moduleRef.get(CWD)).toBe('/work');
    expect(moduleRef.get(ENV)).toEqual({ A: '1' });
    expect(moduleRef.get(STDOUT)).toBe(platform.stdout);
    expect(moduleRef.get(STDERR)).toBe(platform.stderr);
    expect(moduleRef.get(CLOCK)).toBe(platform.clock);
    expect(moduleRef.get(SIGNALS)).toBe(platform.signals);
    expect(moduleRef.get(SPAWN)).toBe(platform.spawn);
    expect(moduleRef.get(WHICH)).toBe(platform.which);
    expect(moduleRef.get(GIT)).toBe(platform.git);
    expect(moduleRef.get(NO_COLOR_FLAG)).toBe(true);
  });

  it('reaches modules that do not import it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot(fakePlatform({ cwd: '/elsewhere' })), FeatureModule],
    }).compile();

    expect(moduleRef.get(Consumer).cwd).toBe('/elsewhere');
  });
});

describe('ExitStatus', () => {
  it('is 0 until a command sets it, and shared by everything that injects it', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PlatformModule.forRoot(fakePlatform())] }).compile();
    const status = moduleRef.get(ExitStatus);

    expect(status.code()).toBe(0);
    status.set(3);
    expect(moduleRef.get(ExitStatus).code()).toBe(3);
  });
});

describe('rawArgsAfter', () => {
  it('drops the command path that chose them, keeping everything else as typed', () => {
    expect(rawArgsAfter(['projects', 'create-project', 'x', '--app-dir', 'a'], 'projects', 'create-project')).toEqual([
      'x',
      '--app-dir',
      'a',
    ]);
    expect(rawArgsAfter(['projects', '--help'], 'projects', 'create-project')).toEqual(['--help']);
    expect(rawArgsAfter(['tests', '--x', '--', 'y'], 'tests')).toEqual(['--x', '--', 'y']);
    expect(rawArgsAfter(['product-owner', '--dry-run'], 'agents')).toEqual(['product-owner', '--dry-run']);
  });
});

describe('takeGlobalFlags', () => {
  it('takes --no-color out wherever it is before --, and leaves what follows -- alone', () => {
    expect(takeGlobalFlags(['--no-color', 'agents', 'x', '--no-color'])).toEqual({
      argv: ['agents', 'x'],
      noColorFlag: true,
    });
    expect(takeGlobalFlags(['terminal', 'run', '--label', 'a', '--', 'tool', '--no-color'])).toEqual({
      argv: ['terminal', 'run', '--label', 'a', '--', 'tool', '--no-color'],
      noColorFlag: false,
    });
    expect(takeGlobalFlags([])).toEqual({ argv: [], noColorFlag: false });
  });
});
