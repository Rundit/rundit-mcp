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
}

export type ZodRawShape = Record<string, ZodTypeAny>;

export function schemaToZodShape(schema: JsonSchemaFragment): ZodRawShape {
  if (schema.type !== 'object' || !schema.properties) return {};
  const required = new Set(schema.required ?? []);
  const shape: ZodRawShape = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodType = schemaToZod(prop);
    if (!required.has(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }
  return shape;
}

function schemaToZod(schema: JsonSchemaFragment): ZodTypeAny {
  let base: ZodTypeAny;
  switch (schema.type) {
    case 'string':
      let text = z.string();
      if (schema.minLength !== undefined) text = text.min(schema.minLength);
      if (schema.maxLength !== undefined) text = text.max(schema.maxLength);
      if (schema.pattern) text = text.regex(new RegExp(schema.pattern));
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
      let array = z.array(schema.items ? schemaToZod(schema.items) : z.unknown());
      if (schema.minItems !== undefined) array = array.min(schema.minItems);
      if (schema.maxItems !== undefined) array = array.max(schema.maxItems);
      base = array;
      break;
    case 'object':
      if (schema.properties) {
        const required = new Set(schema.required ?? []);
        const inner: ZodRawShape = {};
        for (const [k, p] of Object.entries(schema.properties)) {
          let zt = schemaToZod(p);
          if (!required.has(k)) zt = zt.optional();
          inner[k] = zt;
        }
        base = z.object(inner);
      } else {
        base = z.record(z.string(), z.unknown());
      }
      break;
    default:
      base = z.unknown();
  }
  if (schema.nullable) base = base.nullable();
  if (schema.description) base = base.describe(schema.description);
  return base;
}
