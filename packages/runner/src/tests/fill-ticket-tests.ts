import fs from 'node:fs';
import path from 'node:path';

import {
  fullTicket,
  resolveReportFolder,
  resolveTicketRunsRoot,
  ticketJsonPath,
  ticketSuffix,
  type ProjectLocations,
} from '@choliba/projects';
import { writeStderr, writeStdout, type Writable } from '@choliba/core';

import { flattenResults, isRealFailure } from './playwright-results';

interface Criterion {
  id: string;
  testes?: string[];
}

interface TicketJson {
  criterios?: Criterion[];
}

export function shortTitle(fullTitle: string): string {
  const separatorIndex = fullTitle.indexOf(' › ');
  const firstSegment = separatorIndex === -1 ? fullTitle : fullTitle.slice(0, separatorIndex);
  const rest = separatorIndex === -1 ? '' : fullTitle.slice(separatorIndex);
  return path.basename(firstSegment) + rest;
}

export function specFileFromFullTitle(fullTitle: string): string {
  const separatorIndex = fullTitle.indexOf(' › ');
  return separatorIndex === -1 ? fullTitle : fullTitle.slice(0, separatorIndex);
}

export function anchorSpecFile(ticketJson: TicketJson): string | null {
  const counts = new Map<string, number>();
  for (const criterion of ticketJson.criterios ?? []) {
    const first = (criterion.testes ?? [])[0];
    if (!first) continue;
    const file = specFileFromFullTitle(first);
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [file, count] of counts) {
    if (count > bestCount) {
      best = file;
      bestCount = count;
    }
  }
  return best;
}

export interface FillTicketTestsOutput {
  stdout?: Writable;
  stderr?: Writable;
}

export function fillTicketTests(
  target: string,
  locations: Pick<ProjectLocations, 'CHOL_PROJECTS_DIR' | 'CHOL_TICKET_RUNS'>,
  output: FillTicketTestsOutput = {},
): void {
  const projectsDir = locations.CHOL_PROJECTS_DIR;
  const stdout = output.stdout ?? {
    write: (chunk) => {
      writeStdout(chunk);
    },
  };
  const stderr = output.stderr ?? {
    write: (chunk) => {
      writeStderr(chunk);
    },
  };
  const [project, rawTicket] = target.split(':');
  if (!project || !rawTicket) {
    throw new Error('use <project>:<ticket>');
  }

  const ticket = fullTicket(project, rawTicket);
  const ticketPath = ticketJsonPath(projectsDir, project, rawTicket);
  if (!fs.existsSync(ticketPath)) {
    throw new Error(`Ticket não encontrado: ${ticketPath}`);
  }

  const ticketJson = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as TicketJson;
  const ticketRunsRoot = resolveTicketRunsRoot(locations);
  const reportFolder = resolveReportFolder(ticketRunsRoot, project, ticket);
  const resultsJsonPath = path.join(reportFolder, 'results.json');

  if (!fs.existsSync(resultsJsonPath)) {
    throw new Error(`Nenhum results.json em ${resultsJsonPath} — rode os testes antes.`);
  }

  const results = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf-8')) as { suites?: unknown[] };
  const flat = flattenResults((results.suites ?? []) as Parameters<typeof flattenResults>[0]);

  const filled: string[] = [];
  const ambiguous: { id: string; files: string[] }[] = [];
  const anchorFile = anchorSpecFile(ticketJson);

  for (const criterion of ticketJson.criterios ?? []) {
    if ((criterion.testes ?? []).length > 0) continue;

    const forCriterion = flat.filter((row) => row.fullTitle.split(' › ').pop()?.startsWith(`${criterion.id}:`));
    if (forCriterion.length === 0) continue;

    const distinctFiles = new Set(forCriterion.map((row) => specFileFromFullTitle(row.fullTitle)));
    const divergesFromAnchor =
      anchorFile != null && ![...distinctFiles].some((file) => path.basename(file) === anchorFile);

    if (distinctFiles.size > 1 || divergesFromAnchor) {
      ambiguous.push({ id: criterion.id, files: [...distinctFiles] });
      continue;
    }

    const reference = forCriterion.find((row) => row.status === 'expected' || row.status === 'flaky');
    const hasFailure = forCriterion.some((row) => isRealFailure(row.status));
    if (reference == null || hasFailure) continue;

    criterion.testes = [shortTitle(reference.fullTitle)];
    filled.push(criterion.id);
  }

  if (ambiguous.length > 0) {
    stderr.write('Aviso: ID de critério colidiu com outro spec, pulado:\n');
    for (const { id, files } of ambiguous) {
      stderr.write(`  - ${id}: ${files.join(', ')}\n`);
    }
  }

  if (filled.length === 0) {
    stdout.write(`Nada novo pra preencher em ${project}:${ticketSuffix(project, rawTicket)}.\n`);
    return;
  }

  fs.writeFileSync(ticketPath, `${JSON.stringify(ticketJson, null, 2)}\n`);
  stdout.write(`testes[] preenchido em ${ticketPath}: ${filled.join(', ')}\n`);
}
