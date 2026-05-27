import { z, type ZodTypeAny } from 'zod';

export interface JsonSchemaFragment {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaFragment;
  properties?: Record<string, JsonSchemaFragment>;
  required?: string[];
  additionalProperties?: boolean;
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
      base = schema.enum && schema.enum.length > 0
        ? z.enum(schema.enum as [string, ...string[]])
        : z.string();
      break;
    case 'integer':
    case 'number':
      base = z.number();
      break;
    case 'boolean':
      base = z.boolean();
      break;
    case 'array':
      base = z.array(schema.items ? schemaToZod(schema.items) : z.unknown());
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
  if (schema.description) base = base.describe(schema.description);
  return base;
}
