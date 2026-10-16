import { z, type ZodTypeAny } from 'zod';

export interface JsonSchemaFragment {
  type?: string;
  nullable?: boolean;
  description?: string;
  enum?: string[];
  items?: JsonSchemaFragment;
  properties?: Record<string, JsonSchemaFragment>;
  required?: string[];
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  title?: string;
  'x-empty-as-null'?: boolean;
}

export type ZodRawShape = Record<string, ZodTypeAny>;

export function schemaToZodShape(schema: JsonSchemaFragment): ZodRawShape {
  if (schema.type !== 'object' || !schema.properties) return {};
  const required = new Set(schema.required ?? []);
  const shape: ZodRawShape = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodType = schemaToZod(prop, key);
    if (!required.has(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }
  return shape;
}

function schemaToZod(schema: JsonSchemaFragment, fieldName?: string): ZodTypeAny {
  let base: ZodTypeAny;
  switch (schema.type) {
    case 'string':
      const isUrl = schema.format === 'uri' || schema.format === 'url';
      const label = schema.title ?? (fieldName ? fieldName[0].toUpperCase() + fieldName.slice(1) : 'Value');
      const httpOnly = ['^https?://', '^[Hh][Tt][Tt][Pp][Ss]?://', '^[Hh][Tt][Tt][Pp][Ss]?:'].includes(schema.pattern ?? '');
      const urlMessage = `${label} must be a valid ${httpOnly ? 'HTTP or HTTPS ' : ''}URL.`;
      let text = z.string();
      if (['email', 'uri', 'url'].includes(schema.format ?? '')) text = text.trim();
      if (schema.minLength !== undefined) text = text.min(schema.minLength);
      if (schema.maxLength !== undefined) text = text.max(schema.maxLength);
      if (schema.pattern) text = text.regex(new RegExp(schema.pattern), isUrl ? urlMessage : undefined);
      if (schema.format === 'email') text = text.email();
      if (isUrl) text = text.url(urlMessage);
      if (schema.format === 'uuid') text = text.uuid();
      base = text;
      if (schema.enum && schema.enum.length > 0) {
        const choices = z.enum(schema.enum as [string, ...string[]]);
        base = schema.minLength !== undefined || schema.maxLength !== undefined || schema.pattern
          ? text.and(choices)
          : choices;
      }
      break;
    case 'integer':
    case 'number':
      let number = z.number();
      if (schema.type === 'integer') number = number.int();
      if (schema.minimum !== undefined) number = number.min(schema.minimum);
      if (schema.maximum !== undefined) number = number.max(schema.maximum);
      base = number;
      break;
    case 'boolean':
      base = z.boolean();
      break;
    case 'array':
      let array = z.array(schema.items ? schemaToZod(schema.items, fieldName) : z.unknown());
      if (schema.minItems !== undefined) array = array.min(schema.minItems);
      if (schema.maxItems !== undefined) array = array.max(schema.maxItems);
      base = array;
      break;
    case 'object':
      if (schema.properties) {
        const required = new Set(schema.required ?? []);
        const inner: ZodRawShape = {};
        for (const [k, p] of Object.entries(schema.properties)) {
          let zt = schemaToZod(p, k);
          if (!required.has(k)) zt = zt.optional();
          inner[k] = zt;
        }
        base = schema.additionalProperties === true ? z.object(inner).passthrough() : z.object(inner).strict();
      } else {
        base = z.record(z.string(), z.unknown());
      }
      break;
    default:
      base = z.unknown();
  }
  if (schema.nullable) base = base.nullable();
  if (schema.nullable && schema['x-empty-as-null']) {
    // Keep blank clears visible when this validator is converted back to tool JSON Schema.
    const clearable = z.union([base, z.string().regex(/^\s*$/).transform(() => null)]);
    base = z.preprocess(value => typeof value === 'string' ? value.trim() || null : value, clearable);
  }
  if (schema.description) base = base.describe(schema.description);
  return base;
}
