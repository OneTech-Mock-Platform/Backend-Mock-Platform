export type ConstraintViolation = {
  example: Record<string, unknown>;
  violation: string;
};

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
    return { example, violation: `${field} manquant` };
  }

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    if (prop?.pattern) {
      return { example: { ...validExample, [key]: 'INVALID_FORMAT!!' }, violation: `${key} au format invalide` };
    }
  }

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    if (prop?.enum) {
      return { example: { ...validExample, [key]: 'INVALID_ENUM_VALUE' }, violation: `${key} hors des valeurs autorisées` };
    }
  }

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    if (prop?.minLength !== undefined) {
      return {
        example: { ...validExample, [key]: 'a'.repeat(Math.max(0, prop.minLength - 1)) },
        violation: `${key} trop court`,
      };
    }
    if (prop?.minimum !== undefined) {
      return { example: { ...validExample, [key]: prop.minimum - 1 }, violation: `${key} hors des bornes autorisées` };
    }
    if (prop?.maximum !== undefined) {
      return { example: { ...validExample, [key]: prop.maximum + 1 }, violation: `${key} hors des bornes autorisées` };
    }
  }

  return null;
}
