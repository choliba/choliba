import type { ProjectSettings } from './project-settings';
import type { RunningApp } from './project-app-ensure';

/** A project's application in this process: what made it up, and how many runs use it. */
interface SharedApp {
  readonly app: Promise<RunningApp>;
  users: number;
}

/** The applications of this process, by project. */
const shared = new Map<string, SharedApp>();

/** How many holds keep each project's application up between runs (`holdApp`). */
const holds = new Map<string, number>();

function holding(project: string): number {
  return holds.get(project) ?? 0;
}

/** Stops `project`'s application once no run uses it and nothing holds it up, if choliba started it. */
function release(project: string): void {
  const entry = shared.get(project);
  if (entry === undefined || entry.users > 0 || holding(project) > 0) return;
  shared.delete(project);
  // Made up already: an application that failed to come up left `shared` with the runs that waited for it.
  void entry.app.then((app) => {
    app.stop();
  });
}

/**
 * The project's application for a run, shared by every run of this process: the first run makes sure it is up
 * (`ensure`, `ensureApp`), the others take the same one, and its `stop` gives it back; it stops when the last run gives
 * it back and nothing holds it up (`holdApp`), and only when choliba started it. A failure to make it up is the
 * failure of each run that waited for it, and the next run tries again.
 */
export async function shareApp(
  settings: ProjectSettings,
  ensure: (settings: ProjectSettings) => Promise<RunningApp>,
): Promise<RunningApp> {
  const project = settings.project;
  let entry = shared.get(project);
  if (entry === undefined) {
    entry = { app: ensure(settings), users: 0 };
    shared.set(project, entry);
  }
  const taken = entry;
  taken.users += 1;
  let app: RunningApp;
  try {
    app = await taken.app;
  } catch (error) {
    taken.users -= 1;
    if (shared.get(project) === taken) shared.delete(project);
    throw error;
  }
  let given = false;
  return {
    started: app.started,
    stop: () => {
      if (given) return;
      given = true;
      taken.users -= 1;
      release(project);
    },
  };
}

/**
 * Holds `project`'s application up between runs (a sequence of agents, between one agent and the next): while held,
 * the last run giving it back does not stop it. The returned function lets go, once; the application then stops if
 * no run uses it.
 */
export function holdApp(project: string): () => void {
  holds.set(project, holding(project) + 1);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    const left = holding(project) - 1;
    if (left > 0) holds.set(project, left);
    else holds.delete(project);
    release(project);
  };
}
