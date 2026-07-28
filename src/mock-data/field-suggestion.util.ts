import { createHash } from 'crypto';

export function buildFieldKey(type: string, name: string, description?: string): string {
  return createHash('sha1').update(`${type}|${name}|${description ?? ''}`).digest('hex');
}

const COVERED_HEURISTICS = /message|reason|description|status|creator|createdBy|author|name|key|code|field|info|context/i;

export function isWeakStringField(schema: any, fieldName?: string): boolean {
  if (schema?.type !== 'string') return false;
  if (schema.example !== undefined) return false;
  if (schema.enum) return false;
  if (schema.format) return false; 
  if (schema.minLength) return false;
  if (fieldName && COVERED_HEURISTICS.test(fieldName)) return false;
  return true;
}
export function isWeakObjectField(schema: any): boolean {
  return (
    schema?.type === 'object' &&
    schema.additionalProperties === true && 
    schema.example === undefined
  );
}
