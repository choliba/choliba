# Testing Nest code in choliba

One Jest config at the root, specs only in `src/__tests__/**/*.spec.ts`. Nest's default layout (a `.spec.ts`
next to each file and a `test/` folder with its own `jest-e2e.json`) does not apply: Jest here would never discover
those files, and a second config would split the coverage ratchet. Read `typescript-and-di.md` first: without the
decorator flags in Jest, none of this resolves.

## Unit: a provider through a testing module

Build the real module and swap only what touches disk, network or the CLI packages:

```ts
import { Test } from '@nestjs/testing';
import { ProjectsModule } from '../../projects/projects.module';
import { ProjectsService } from '../../projects/projects.service';
import { PROJECT_LOCATIONS } from '../../projects/projects.tokens';

describe('ProjectsService', () => {
  it('lists the projects of the configured folder', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProjectsModule] })
      .overrideProvider(PROJECT_LOCATIONS)
      .useValue({ projectsDir: fixtureDir })
      .compile();

    expect(moduleRef.get(ProjectsService).list()).toEqual(['shop']);
  });
});
```

Prefer real temp folders (see `packages/core/src/__tests__/helpers/tmp.ts`) over mocking `@choliba/*` functions:
the wrappers are thin on purpose, so the behaviour worth testing is the combination.

## HTTP: the app in-process

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
await request(app.getHttpServer()).get('/projects').expect(200);
await app.close();
```

Always `app.close()` (in `afterEach`/`afterAll`): Jest runs with `detectOpenHandles`, and a server left open fails
the run.

## Coverage

`main.ts` is already excluded (wiring only). Modules, controllers, guards and pipes are not, and should not be:
compiling the testing module covers module declarations, and HTTP specs cover controllers. If a file is hard to
reach, that is a design signal, not a reason to exclude it (see `coverage-ratchet`).
