import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv, { type ErrorObject } from 'ajv';
import { validateXML } from 'xmllint-wasm';
import { parse as parseYaml } from 'yaml';
import { findResource } from '@choliba/core/config';

/**
 * Split out of `agent-loader.ts` (which needs these to make `loadAgent` fail for real on a
 * malformed agent) and `commands/agent.ts` (which needs them to print a standalone validation
 * report) — living here instead of either one avoids a circular import between the two.
 */

/** `schemes/` sits at the root of `@choliba/agents` (and of the built package), alongside `package.json`. */
const SCHEMES_DIR = findResource('schemes', __dirname);
const SYSTEM_SCHEMA_PATH = join(SCHEMES_DIR, 'agent.xsd');
/** The types `agent.xsd` includes (`<xs:include schemaLocation="agent-types.xsd"/>`). */
const AGENT_TYPES_XSD = {
  fileName: 'agent-types.xsd',
  contents: readFileSync(join(SCHEMES_DIR, 'agent-types.xsd'), 'utf8'),
};
const SYSTEM_SCHEMA = { fileName: 'agent.xsd', contents: readFileSync(SYSTEM_SCHEMA_PATH, 'utf8') };

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
  return typeof id === 'string' && id !== folder ? [`/agent/id "${id}" precisa ser igual ao nome da pasta "${folder}"`] : [];
}

/** The other rule the schema cannot state (not in plain JSON Schema): `modes.default` is one of `modes.allow`. */
function modeProblem(doc: Record<string, unknown>): readonly string[] {
  const modes = doc['modes'];
  if (!isRecord(modes) || !Array.isArray(modes['allow']) || modes['default'] === undefined) {
    return [];
  }
  return modes['allow'].includes(modes['default'])
    ? []
    : [`/modes/default ${JSON.stringify(modes['default'])} precisa estar em modes.allow`];
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
 * Validates `system.md`'s text as XML against `agent.xsd` — real libxml2 (compiled to WebAssembly via
 * `xmllint-wasm`, no native bindings needed), not just a well-formedness check: this also enforces
 * which tags are allowed where, per the XSD's content model. Every agent's `system.md` needs exactly
 * one `<agent>` root (see `agent.xsd`'s own comment on why).
 */
export async function validateSystemMd(xmlText: string): Promise<ValidationResult> {
  const result = await validateXML({
    xml: { fileName: 'system.md', contents: xmlText },
    schema: SYSTEM_SCHEMA,
    preload: AGENT_TYPES_XSD,
  });
  return {
    valid: result.valid,
    errors: result.errors.map((error) => error.message),
  };
}

/**
 * Validates every file in `{agentsDir}/{name}/` before anything else is done with that agent —
 * `agent.yaml` against its standard (`validateAgentYamlV1`), `system.md` against `agent.xsd`. Reports
 * every problem across both files (never throws), unlike `loadAgent`, which stops at the first file.
 */
export async function validateAgentFiles(agentsDir: string, name: string): Promise<ValidationResult> {
  const dir = join(agentsDir, name);
  const yaml = readAgentFile(join(dir, 'agent.yaml'));
  const system = readAgentFile(join(dir, 'system.md'));
  const errors = [
    ...located(yaml, (text) => validateAgentYamlV1(text, name)),
    ...located(system, () => ({ valid: true, errors: [] })),
  ];
  if (system.text !== undefined) {
    errors.push(...(await validateSystemMd(system.text)).errors.map((error) => `${system.path}: ${error}`));
  }
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
