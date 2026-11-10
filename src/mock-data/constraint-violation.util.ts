export type ConstraintViolation = {
  example: Record<string, unknown>;
  violation: string;
  field: string;
 
  message?: string;
};

type ParsedParameterLike = {
  name: string;
  required?: boolean;
  schema?: any;
};


export function parametersToObjectSchema(parameters: ParsedParameterLike[]): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of parameters) {
    if (!param.schema) continue;
    properties[param.name] = param.schema;
    if (param.required) required.push(param.name);
  }

  return { type: 'object', properties, required };
}


function generatePatternViolatingValue(pattern: string): string {
  const forbiddenRepeat = pattern.match(/\(\?!(.)\{(\d+)\}\$?\)/);
  if (forbiddenRepeat) {
    const [, char, count] = forbiddenRepeat;
    return char.repeat(Number(count));
  }

  
  const lengthMatch = pattern.match(/\{(\d+)\}/);
  if (lengthMatch) {
    const expectedLength = Number(lengthMatch[1]);
    const wrongLength = Math.max(1, expectedLength - 1);
    return '9'.repeat(wrongLength);
  }

  return 'INVALID_FORMAT';
}

export function generateViolatingExample(
  validExample: Record<string, unknown>,
  schema: any,
): ConstraintViolation | null {
  if (!schema?.properties) return null;

  const required: string[] = schema.required ?? [];
  if (required.length > 0) {
    const field = required[0];
    const example = { ...validExample };
    delete example[field];
    return { example, violation: `${field} manquant`, field };
  }

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    if (prop?.pattern) {
      return {
        example: { ...validExample, [key]: generatePatternViolatingValue(prop.pattern) },
        violation: `${key} au format invalide`,
        field: key,
        message: prop['x-pattern-message'],
      };
    }
  }

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    if (prop?.enum) {
      return { example: { ...validExample, [key]: 'INVALID_ENUM_VALUE' }, violation: `${key} hors des valeurs autorisées`, field: key };
    }
  }

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    if (prop?.minLength !== undefined) {
      return {
        example: { ...validExample, [key]: 'a'.repeat(Math.max(0, prop.minLength - 1)) },
        violation: `${key} trop court`,
        field: key,
      };
    }
    if (prop?.minimum !== undefined) {
      return { example: { ...validExample, [key]: prop.minimum - 1 }, violation: `${key} hors des bornes autorisées`, field: key };
    }
    if (prop?.maximum !== undefined) {
      return { example: { ...validExample, [key]: prop.maximum + 1 }, violation: `${key} hors des bornes autorisées`, field: key };
    }
  }

  return null;
}
