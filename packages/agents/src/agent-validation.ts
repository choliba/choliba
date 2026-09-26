import { existsSync, readFileSync } from 'node:fs';
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
const AGENT_YAML_SCHEMA = JSON.parse(readFileSync(join(SCHEMES_DIR, 'agent.schema.json'), 'utf8')) as object;
const DEFAULT_SCHEMA_PATH = join(SCHEMES_DIR, 'agent.xsd');
/** The types every agent schema includes (`<xs:include schemaLocation="agent-types.xsd"/>`). */
const AGENT_TYPES_XSD: XmlFile = {
  fileName: 'agent-types.xsd',
  contents: readFileSync(join(SCHEMES_DIR, 'agent-types.xsd'), 'utf8'),
};

interface XmlFile {
  readonly fileName: string;
  readonly contents: string;
}

/** An agent's own schema file, next to its `system.md`; optional. */
export const AGENT_SCHEMA_FILE = 'system.xsd';

/** A schema to validate `system.md` against, and where it came from (for error messages). */
export interface AgentSchema {
  readonly path: string;
  readonly contents: string;
}

const DEFAULT_SCHEMA: AgentSchema = { path: DEFAULT_SCHEMA_PATH, contents: readFileSync(DEFAULT_SCHEMA_PATH, 'utf8') };

/**
 * The schema for the agent in `agentDir`: its own `system.xsd` when it has one (which includes the base
 * types and may restrict the `Agent` type, e.g. to make a section required), the default `agent.xsd`
 * otherwise.
 */
export function agentSchemaFor(agentDir: string): AgentSchema {
  const path = join(agentDir, AGENT_SCHEMA_FILE);
  return existsSync(path) ? { path, contents: readFileSync(path, 'utf8') } : DEFAULT_SCHEMA;
}

const ajv = new Ajv({ allErrors: true });
const validateAgainstAgentYamlSchema = ajv.compile(AGENT_YAML_SCHEMA);

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Formats one AJV error from `agent.schema.json` validation for human-readable output. */
export function formatAgentYamlSchemaError(error: ErrorObject): string {
  const path = error.instancePath === '' ? '(raiz)' : error.instancePath;
  const extraField =
    error.keyword === 'additionalProperties' && typeof error.params['additionalProperty'] === 'string'
      ? ` "${error.params['additionalProperty']}"`
      : '';
  return `${path}${extraField} ${error.message ?? 'inválido'}`.trim();
}

/** Validates `agent.yaml`'s text against `agent.schema.json` (id/name/version/description/supported_models required, skills/mcps optional — mirrors, formally, what `parseAgentYaml` in `agent-loader.ts` already enforces in code). */
export function validateAgentYaml(yamlText: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (error) {
    return { valid: false, errors: [`YAML inválido: ${String(error)}`] };
  }

  const valid = validateAgainstAgentYamlSchema(parsed);
  if (valid) return { valid: true, errors: [] };

  return { valid: false, errors: mapAgentYamlSchemaErrors(validateAgainstAgentYamlSchema.errors) };
}

/** Maps AJV errors to strings; `undefined`/`null` yields an empty list (defensive — AJV normally sets `.errors` on failure). */
export function mapAgentYamlSchemaErrors(errors: readonly ErrorObject[] | null | undefined): readonly string[] {
  return (errors ?? []).map(formatAgentYamlSchemaError);
}

/**
 * Validates `system.md`'s text as XML against `schema` (the default `agent.xsd` unless given) — real libxml2 (compiled to
 * WebAssembly via `xmllint-wasm`, no native bindings needed), not just a well-formedness check:
 * this also enforces which tags/attributes are allowed where, per the XSD's content model. Every
 * agent's `system.md` needs exactly one `<agent>` root (see `agent.xsd`'s own comment on why).
 */
export async function validateSystemMd(
  xmlText: string,
  schema: AgentSchema = DEFAULT_SCHEMA,
): Promise<ValidationResult> {
  const result = await validateXML({
    xml: { fileName: 'system.md', contents: xmlText },
    schema: { fileName: AGENT_SCHEMA_FILE, contents: schema.contents },
    preload: AGENT_TYPES_XSD,
  });
  return {
    valid: result.valid,
    errors: result.errors.map((error) => error.message),
  };
}

/**
 * Validates every file in `{agentsDir}/{name}/` before anything else is done with that agent —
 * `agent.yaml` against `agent.schema.json`, `system.md` against its schema (`agentSchemaFor`). Reports every
 * problem across both files (never throws), unlike `loadAgent`, which stops at the first one.
 */
export async function validateAgentFiles(agentsDir: string, name: string): Promise<ValidationResult> {
  const dir = join(agentsDir, name);
  const yamlPath = join(dir, 'agent.yaml');
  const systemPath = join(dir, 'system.md');

  const errors: string[] = [];

  let yamlText: string | undefined;
  try {
    yamlText = readFileSync(yamlPath, 'utf8');
  } catch {
    errors.push(`${yamlPath}: arquivo não encontrado`);
  }
  if (yamlText !== undefined) {
    errors.push(...validateAgentYaml(yamlText).errors.map((error) => `${yamlPath}: ${error}`));
  }

  let systemText: string | undefined;
  try {
    systemText = readFileSync(systemPath, 'utf8');
  } catch {
    errors.push(`${systemPath}: arquivo não encontrado`);
  }
  if (systemText !== undefined) {
    const schema = agentSchemaFor(dir);
    const result = await validateSystemMd(systemText, schema);
    errors.push(...result.errors.map((error) => `${systemPath} (schema ${schema.path}): ${error}`));
  }

  return { valid: errors.length === 0, errors };
}
