import { PrismaService } from '../prisma/prisma.service';
import { parametersToObjectSchema } from './constraint-violation.util';
import { buildFieldKey, isWeakObjectField, isWeakStringField } from './field-suggestion.util';

export type WeakField = {
  id: string; // = fieldKey (hash), utilisé aussi comme clé de sortie attendue de Gemini
  name: string;
  type: 'string' | 'object';
  description?: string;
  parentSchema: string;
};

type EndpointDetails = {
  requestBody?: { schema?: any } | null;
  parameters?: { name: string; required?: boolean; schema?: any }[];
  responses?: { statusCode: string; description: string; contentType?: string; schema?: any }[];
};

// Traverse un schéma en mirroring exact de MockDataService.generate() : mêmes règles de
// récursion (properties / items / additionalProperties-objet), même cutoff de profondeur,
// pour repérer les feuilles qui retomberaient sur le fallback générique 'string_value' / {}.
// Le fieldName n'est PAS propagé dans les items d'array (generateArray ne le fait pas non
// plus), sans quoi on demanderait des suggestions Gemini pour des clés jamais interrogées
// au moment de la génération réelle.
function walk(schema: any, fieldName: string | undefined, depth: number, endpointHint: string, out: Map<string, WeakField>) {
  if (!schema || depth > 6) return;
  if (schema.example !== undefined) return;
  if (schema.enum) return;

  if (schema.type === 'string') {
    if (fieldName && isWeakStringField(schema, fieldName)) {
      const key = buildFieldKey('string', fieldName, schema.description);
      if (!out.has(key)) {
        out.set(key, { id: key, name: fieldName, type: 'string', description: schema.description, parentSchema: endpointHint });
      }
    }
    return;
  }

  if (schema.type === 'array') {
    if (schema.items) walk(schema.items, undefined, depth + 1, endpointHint, out);
    return;
  }

  if (schema.type === 'object' || schema.properties) {
    if (schema.properties) {
      for (const [key, prop] of Object.entries<any>(schema.properties)) {
        walk(prop, key, depth + 1, endpointHint, out);
      }
      return;
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      walk(schema.additionalProperties, 'info', depth + 1, endpointHint, out);
      return;
    }

    if (fieldName && isWeakObjectField(schema)) {
      const key = buildFieldKey('object', fieldName, schema.description);
      if (!out.has(key)) {
        out.set(key, { id: key, name: fieldName, type: 'object', description: schema.description, parentSchema: endpointHint });
      }
    }
  }
}

// specId optionnel : scope la collecte à une seule spec (import/mise à jour en cours) pour
// éviter de rescanner toute la base à chaque fois. Omis => toutes les specs (retrofill).
export async function collectWeakFields(prisma: PrismaService, specId?: string): Promise<WeakField[]> {
  const endpoints = await prisma.endpoint.findMany(specId ? { where: { specId } } : undefined);
  const found = new Map<string, WeakField>();

  for (const endpoint of endpoints) {
    const details = endpoint.responses as EndpointDetails | null;
    if (!details) continue;

    const endpointHint = `${endpoint.method} ${endpoint.path}`;
    const requestBodySchema = details.requestBody?.schema;

    if (requestBodySchema) {
      walk(requestBodySchema, undefined, 0, endpointHint, found);
    } else if (details.parameters?.length) {
      walk(parametersToObjectSchema(details.parameters), undefined, 0, endpointHint, found);
    }

    for (const response of details.responses ?? []) {
      if (response.schema) walk(response.schema, undefined, 0, endpointHint, found);
    }
  }

  return Array.from(found.values());
}
