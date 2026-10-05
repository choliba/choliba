import fs from 'node:fs';

import {
  canonicalizeSuffix,
  fullTicket,
  listTicketSuffixes,
  ticketFilePath,
  ticketsFolderPath,
} from '@choliba/projects';

export function trim(value: string): string {
  return value.trim();
}

export function stripProjectPrefix(project: string, item: string): string {
  const trimmed = trim(item);
  return trimmed.startsWith(`${project}-`) ? trimmed.slice(project.length + 1) : trimmed;
}

export function ticketExists(projectsDir: string, project: string, suffix: string): boolean {
  return fs.existsSync(ticketFilePath(projectsDir, project, suffix));
}

export function resolveCanonicalSuffix(projectsDir: string, project: string, suffix: string): string {
  return canonicalizeSuffix(projectsDir, project, suffix);
}

export function isMultiTicketSelector(value: string): boolean {
  if (/[*?[\]]/.test(value) || value.includes(',') || value.includes(' - ')) return true;
  const match = /^(.+)-(\d+)-(.+)-(\d+)$/.exec(value);
  return match !== null && match[1] === match[3];
}

function parseNumericTicketSuffix(item: string): { prefix: string; number: string } | null {
  if (/^\d+$/.test(item)) return { prefix: '', number: item };
  const match = /^(.*[^0-9])([0-9]+)$/.exec(item);
  if (!match?.[1] || !match[2]) return null;
  return { prefix: match[1], number: match[2] };
}

export function listMatchingTicketKeys(projectsDir: string, project: string, pattern: string): string[] {
  const patternLower = pattern.toLowerCase();
  const keys: string[] = [];

  for (const suffix of listTicketSuffixes(ticketsFolderPath(projectsDir, project))) {
    const key = fullTicket(project, suffix);
    if (
      suffix.toLowerCase().includes(patternLower.replace(/[*?[\]]/g, '')) ||
      key.toLowerCase().includes(patternLower.replace(/[*?[\]]/g, '')) ||
      globMatch(suffix, pattern) ||
      globMatch(key, pattern)
    ) {
      keys.push(key);
    }
  }

  return [...new Set(keys)].sort();
}

function globMatch(text: string, pattern: string): boolean {
  if (!/[*?[\]]/.test(pattern)) return text.toLowerCase() === pattern.toLowerCase();
  const regex = new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')}$`,
    'i',
  );
  return regex.test(text);
}

export function expandTicketRange(projectsDir: string, project: string, startRaw: string, endRaw: string): string[] {
  const start = stripProjectPrefix(project, startRaw);
  const end = stripProjectPrefix(project, endRaw);
  const startParts = parseNumericTicketSuffix(start);
  const endParts = parseNumericTicketSuffix(end);
  if (!startParts || !endParts) {
    throw new Error('intervalo precisa de sufixo numérico (ex.: CAD-01 - CAD-04).');
  }
  if (startParts.prefix !== endParts.prefix) {
    throw new Error(`intervalo com prefixos diferentes ("${startParts.prefix}" vs "${endParts.prefix}").`);
  }

  const rangeStart = Number.parseInt(startParts.number, 10);
  const rangeEnd = Number.parseInt(endParts.number, 10);
  if (rangeStart > rangeEnd) throw new Error(`intervalo invertido (${start} → ${end}).`);

  const width = Math.max(startParts.number.length, endParts.number.length);
  const generated: string[] = [];

  for (let i = rangeStart; i <= rangeEnd; i += 1) {
    const suffix = resolveCanonicalSuffix(
      projectsDir,
      project,
      `${startParts.prefix}${String(i).padStart(width, '0')}`,
    );
    if (ticketExists(projectsDir, project, suffix)) {
      generated.push(fullTicket(project, suffix));
    }
  }

  if (generated.length === 0) {
    throw new Error(`nenhum ticket em ${project} no intervalo ${start} - ${end}.`);
  }
  return generated;
}

export function expandTicketCsvList(projectsDir: string, project: string, csv: string): string[] {
  const generated: string[] = [];
  for (const item of csv.split(',')) {
    const trimmed = trim(item);
    if (!trimmed) continue;
    const suffix = resolveCanonicalSuffix(projectsDir, project, stripProjectPrefix(project, trimmed));
    if (!ticketExists(projectsDir, project, suffix)) {
      throw new Error(`ticket "${project}:${suffix}" não existe.`);
    }
    generated.push(fullTicket(project, suffix));
  }
  if (generated.length === 0) throw new Error('lista de tickets vazia.');
  return generated;
}

export function expandTicketSelector(projectsDir: string, project: string, selector: string): string[] {
  const trimmed = trim(selector);

  if (/[*?[\]]/.test(trimmed)) {
    const pattern = stripProjectPrefix(project, trimmed);
    const matches = listMatchingTicketKeys(projectsDir, project, pattern);
    if (matches.length === 0) throw new Error(`nenhum ticket em ${project} casa com "${selector}".`);
    return matches;
  }

  if (trimmed.includes(',')) return expandTicketCsvList(projectsDir, project, trimmed);

  if (trimmed.includes(' - ')) {
    const [start, end] = trimmed.split(' - ');
    if (!start || !end) throw new Error(`seletor de ticket não reconhecido: "${selector}".`);
    return expandTicketRange(projectsDir, project, start, end);
  }

  const rangeMatch = /^(.+)-(\d+)-(.+)-(\d+)$/.exec(trimmed);
  if (rangeMatch) {
    const prefix = rangeMatch[1];
    const start = rangeMatch[2];
    const endPrefix = rangeMatch[3];
    const end = rangeMatch[4];
    if (prefix && start && endPrefix && end && prefix === endPrefix) {
      return expandTicketRange(projectsDir, project, `${prefix}-${start}`, `${endPrefix}-${end}`);
    }
  }

  throw new Error(`seletor de ticket não reconhecido: "${selector}".`);
}
