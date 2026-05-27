#!/usr/bin/env node
// Reads the openapi.json shipped with @rundit-sdk/client and emits
// src/generated/tools.ts — one MCP ToolSpec per SDK operation.
//
// Pass --check to verify the committed file matches the current SDK
// without writing; non-zero exit signals drift.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sdkRoot = resolve(root, 'node_modules/@rundit-sdk/client');
const openapiPath = resolve(sdkRoot, 'openapi.json');
const sdkPackagePath = resolve(sdkRoot, 'package.json');
const outPath = resolve(root, 'src/generated/tools.ts');
const checkMode = process.argv.includes('--check');

const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));
const sdkPkg = JSON.parse(readFileSync(sdkPackagePath, 'utf8'));

function resolveRef(ref) {
  const segments = ref.replace(/^#\//, '').split('/');
  let node = openapi;
  for (const seg of segments) node = node?.[seg];
  if (!node) throw new Error(`Unresolved $ref ${ref}`);
  return node;
}

function expand(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref) return expand(resolveRef(schema.$ref));
  if (schema.type === 'array' && schema.items) {
    return { ...schema, items: expand(schema.items) };
  }
  if (schema.type === 'object' && schema.properties) {
    const props = {};
    for (const [k, v] of Object.entries(schema.properties)) props[k] = expand(v);
    return { ...schema, properties: props };
  }
  return schema;
}

const snake = (s) =>
  s.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();

const operations = [];
for (const [path, methods] of Object.entries(openapi.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    const ns = op['x-sdk-namespace'];
    const operation = op['x-sdk-operation'];
    if (!ns || !operation) continue;

    const params = op.parameters ?? [];
    const pathParams = params.filter((p) => p.in === 'path');
    const queryParams = params.filter((p) => p.in === 'query');

    let body = null;
    const bodySchema = op.requestBody?.content?.['application/json']?.schema;
    if (bodySchema) body = expand(bodySchema);

    const properties = {};
    const required = [];

    const addProp = (name, schema, isRequired, description) => {
      const next = { ...schema };
      if (description && !next.description) next.description = description;
      properties[name] = next;
      if (isRequired) required.push(name);
    };

    for (const p of pathParams) addProp(p.name, p.schema, true, p.description);
    for (const p of queryParams) addProp(p.name, p.schema, !!p.required, p.description);
    if (body && body.type === 'object' && body.properties) {
      const bodyRequired = new Set(body.required ?? []);
      for (const [name, schema] of Object.entries(body.properties)) {
        addProp(name, schema, bodyRequired.has(name), undefined);
      }
    }

    operations.push({
      ns,
      operation,
      name: `${snake(ns)}_${snake(operation)}`,
      summary: op.summary ?? '',
      description: op.description ?? null,
      method: method.toUpperCase(),
      path,
      pathParamNames: pathParams.map((p) => p.name),
      hasQuery: queryParams.length > 0,
      hasBody: !!body,
      inputSchema: {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      },
    });
  }
}

operations.sort((a, b) => a.name.localeCompare(b.name));

function describeTool(op) {
  if (op.description && op.summary && op.description !== op.summary) {
    return `${op.summary}\n\n${op.description}`;
  }
  return op.summary || op.description || op.name;
}

function invokeExpr(op) {
  const ns = op.ns;
  const fn = op.operation;
  const pathNames = op.pathParamNames;

  if (op.hasBody) {
    return `(client, args) => client.${ns}.${fn}(args)`;
  }
  if (pathNames.length === 0 && op.hasQuery) {
    return `(client, args) => client.${ns}.${fn}(args)`;
  }
  if (pathNames.length === 0) {
    return `(client) => client.${ns}.${fn}()`;
  }
  if (op.hasQuery) {
    const destructure = pathNames.join(', ');
    const callArgs = pathNames.join(', ');
    return `(client, { ${destructure}, ...query }) => client.${ns}.${fn}(${callArgs}, query)`;
  }
  const destructure = pathNames.join(', ');
  const callArgs = pathNames.join(', ');
  return `(client, { ${destructure} }) => client.${ns}.${fn}(${callArgs})`;
}

function indentJson(value, indent) {
  const pad = ' '.repeat(indent);
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : pad + line))
    .join('\n');
}

const out = [];
out.push('// AUTO-GENERATED FILE — DO NOT EDIT.');
out.push('// Regenerate with: npm run codegen');
out.push(`// Source: @rundit-sdk/client v${sdkPkg.version} (openapi.json)`);
out.push('');
out.push("import type { RunditClient } from '@rundit-sdk/client';");
out.push('');
out.push(`export const SDK_VERSION = ${JSON.stringify(sdkPkg.version)};`);
out.push('');
out.push('export interface ToolSpec {');
out.push('  name: string;');
out.push('  description: string;');
out.push('  inputSchema: {');
out.push("    type: 'object';");
out.push('    properties: Record<string, unknown>;');
out.push('    required?: string[];');
out.push('    additionalProperties?: boolean;');
out.push('  };');
out.push('  // eslint-disable-next-line @typescript-eslint/no-explicit-any');
out.push('  invoke: (client: RunditClient, args: any) => Promise<unknown>;');
out.push('}');
out.push('');
out.push('export const TOOLS: ToolSpec[] = [');
for (const op of operations) {
  out.push('  {');
  out.push(`    name: ${JSON.stringify(op.name)},`);
  out.push(`    description: ${JSON.stringify(describeTool(op))},`);
  out.push(`    inputSchema: ${indentJson(op.inputSchema, 4)},`);
  out.push(`    invoke: ${invokeExpr(op)},`);
  out.push('  },');
}
out.push('];');
out.push('');

const content = out.join('\n');

if (checkMode) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (current !== content) {
    process.stderr.write(
      `[codegen:check] ${outPath} is out of date for @rundit-sdk/client v${sdkPkg.version}.\n` +
        `Run 'npm run codegen' and commit the result.\n`,
    );
    process.exit(1);
  }
  process.stderr.write(`[codegen:check] up to date (${sdkPkg.version}, ${operations.length} tools)\n`);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  process.stderr.write(
    `[codegen] wrote ${operations.length} tools from @rundit-sdk/client v${sdkPkg.version} -> ${outPath}\n`,
  );
}
