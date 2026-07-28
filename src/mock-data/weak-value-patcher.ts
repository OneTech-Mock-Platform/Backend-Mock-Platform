import { buildFieldKey } from './field-suggestion.util';

const GENERIC_STRING = /^string_value(?: #\d+)?$/;

export function patchWeakValues(
  value: unknown,
  schema: any,
  getSuggestion: (fieldKey: string) => unknown,
  fieldName?: string,
  depth = 0,
): unknown {
  if (!schema || depth > 6) return value;

  if (schema.type === 'string') {
    if (fieldName && typeof value === 'string' && GENERIC_STRING.test(value)) {
      const suggestion = getSuggestion(buildFieldKey('string', fieldName, schema.description));
      if (typeof suggestion === 'string') return suggestion;
    }
    return value;
  }

  if (schema.type === 'array') {
    if (!schema.items || !Array.isArray(value)) return value;
    return value.map((item) => patchWeakValues(item, schema.items, getSuggestion, undefined, depth + 1));
  }

  if (schema.type === 'object' || schema.properties) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const obj = value as Record<string, unknown>;

    if (schema.properties) {
      const patched: Record<string, unknown> = { ...obj };
      for (const [key, prop] of Object.entries<any>(schema.properties)) {
        if (key in obj) {
          patched[key] = patchWeakValues(obj[key], prop, getSuggestion, key, depth + 1);
        }
      }
      return patched;
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      if ('info' in obj) {
        return { ...obj, info: patchWeakValues(obj.info, schema.additionalProperties, getSuggestion, 'info', depth + 1) };
      }
      return value;
    }

    if (fieldName && Object.keys(obj).length === 0) {
      const suggestion = getSuggestion(buildFieldKey('object', fieldName, schema.description));
      if (suggestion && typeof suggestion === 'object') return suggestion;
    }
    return value;
  }

  return value;
}
