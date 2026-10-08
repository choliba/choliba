import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv, { type ErrorObject } from 'ajv';
import { parse as parseYaml } from 'yaml';
import { AGENT_FILE, findResource } from '@choliba/core';

/**
 * Split out of `agent-loader.ts` (which needs these to make `loadAgent` fail for real on a
 * malformed agent) and `commands/agent.ts` (which needs them to print a standalone validation
 * report) — living here instead of either one avoids a circular import between the two.
 */

/** `schemes/` sits at the root of `@choliba/agents` (and of the built package), alongside `package.json`. */
const SCHEMES_DIR = findResource('schemes', __dirname);

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Formats one AJV error from the `agent.yaml` schema for human-readable output. */
export function formatAgentYamlSchemaError(error: ErrorObject): string {
  const path = error.instancePath === '' ? '(raiz)' : error.instancePath;
  const extraField =
    error.keyword === 'additionalProperties' && typeof error.params['additionalProperty'] === 'string'
      ? ` "${error.params['additionalProperty']}"`
      : '';
  return `${path}${extraField} ${error.message ?? 'inválido'}`.trim();
}

/** The `agent.yaml` standards this version reads; `version:` (the first key) names one of them. */
export const SUPPORTED_AGENT_YAML_VERSIONS: readonly number[] = [1];

const AGENT_YAML_V1_SCHEMA = JSON.parse(readFileSync(join(SCHEMES_DIR, 'v1', 'agent.schema.json'), 'utf8')) as object;
const validateAgainstAgentYamlV1Schema = new Ajv({ allErrors: true }).compile(AGENT_YAML_V1_SCHEMA);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

/** Why `doc`'s `version` is not a standard this reads, or `undefined` when it is. */
function versionProblem(doc: Record<string, unknown>): string | undefined {
  const version = doc['version'];
  if (typeof version !== 'number' || !SUPPORTED_AGENT_YAML_VERSIONS.includes(version)) {
    const named = version === undefined ? '(ausente)' : JSON.stringify(version);
    return `padrão ${named} não suportado; suportados: ${SUPPORTED_AGENT_YAML_VERSIONS.join(', ')}`;
  }
  return Object.keys(doc)[0] === 'version' ? undefined : '"version" precisa ser a primeira chave';
}

/** The rule the schema cannot state: `agent.id` is the agent's folder name. */
function folderProblem(doc: Record<string, unknown>, folder: string): readonly string[] {
  const agent = doc['agent'];
  const id = isRecord(agent) ? agent['id'] : undefined;
  return typeof id === 'string' && id !== folder
    ? [`/agent/id "${id}" precisa ser igual ao nome da pasta "${folder}"`]
    : [];
}

/** `modes.allow`, or every mode when the file does not restrict them. */
function allowedModes(doc: Record<string, unknown>): readonly unknown[] {
  const modes = doc['modes'];
  return isRecord(modes) && Array.isArray(modes['allow']) ? modes['allow'] : ['execute', 'plan', 'ask'];
}

/**
 * The other rules the schema cannot state (not in plain JSON Schema): `modes.default` and every mode
 * `steps` names are in `modes.allow` — steps for a mode the agent never runs in would never run.
 */
function modeProblem(doc: Record<string, unknown>): readonly string[] {
  const allowed = allowedModes(doc);
  const modes = doc['modes'];
  const defaultMode = isRecord(modes) ? modes['default'] : undefined;
  const steps = doc['steps'];
  const stepModes = isRecord(steps) ? Object.keys(steps) : [];
  return [
    ...(defaultMode === undefined || allowed.includes(defaultMode)
      ? []
      : [`/modes/default ${JSON.stringify(defaultMode)} precisa estar em modes.allow`]),
    ...stepModes
      .filter((mode) => !allowed.includes(mode))
      .map((mode) => `/steps/${mode}: o modo "${mode}" não está em modes.allow`),
  ];
}

/**
 * Validates an `agent.yaml` of standard 1 (`schemes/v1/agent.schema.json`) found in the folder `folder`
 * (`agents/<folder>/`): the version first, since a file of another standard would only yield noise
 * against this schema, then the schema and the folder name, reporting every problem.
 */
export function validateAgentYamlV1(yamlText: string, folder: string): ValidationResult {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (error) {
    return invalid(`YAML inválido: ${String(error)}`);
  }
  if (!isRecord(doc)) {
    return invalid('(raiz) precisa ser um mapa de chaves');
  }
  const problem = versionProblem(doc);
  if (problem !== undefined) {
    return invalid(problem);
  }
  const schemaErrors = validateAgainstAgentYamlV1Schema(doc)
    ? []
    : mapAgentYamlSchemaErrors(validateAgainstAgentYamlV1Schema.errors);
  const errors = [...schemaErrors, ...folderProblem(doc, folder), ...modeProblem(doc)];
  return { valid: errors.length === 0, errors };
}

/** Maps AJV errors to strings; `undefined`/`null` yields an empty list (defensive — AJV normally sets `.errors` on failure). */
export function mapAgentYamlSchemaErrors(errors: readonly ErrorObject[] | null | undefined): readonly string[] {
  return (errors ?? []).map(formatAgentYamlSchemaError);
}

/**
 * Validates `{agentsDir}/{name}/agent.yaml`, the agent's whole declaration, against its standard
 * (`validateAgentYamlV1`), reporting every problem (never throws), unlike `loadAgent`, which throws.
 */
export function validateAgentFiles(agentsDir: string, name: string): ValidationResult {
  const errors = located(readAgentFile(join(agentsDir, name, AGENT_FILE)), (text) => validateAgentYamlV1(text, name));
  return { valid: errors.length === 0, errors };
}

interface AgentFile {
  readonly path: string;
  readonly text: string | undefined;
}

function readAgentFile(path: string): AgentFile {
  try {
    return { path, text: readFileSync(path, 'utf8') };
  } catch {
    return { path, text: undefined };
  }
}

/** `validate`'s errors for `file`, each prefixed by its path; a missing file is its only error. */
function located(file: AgentFile, validate: (text: string) => ValidationResult): readonly string[] {
  if (file.text === undefined) {
    return [`${file.path}: arquivo não encontrado`];
  }
  return validate(file.text).errors.map((error) => `${file.path}: ${error}`);
}
