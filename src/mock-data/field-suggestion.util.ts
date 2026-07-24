import { createHash } from 'crypto';

export function buildFieldKey(type: string, name: string, description?: string): string {
  return createHash('sha1').update(`${type}|${name}|${description ?? ''}`).digest('hex');
}

// Doit rester synchronisé avec les regex de generateBaseString() dans mock-data.service.ts :
// un champ dont le nom matche une de ces regex reçoit toujours une valeur déterministe
// (quel que soit le contexte runtime), donc n'est jamais "faible" au sens de ce module.
const COVERED_HEURISTICS = /message|reason|description|status|creator|createdBy|author|name|key|code|field|info|context/i;

// Un champ string "faible" est un champ pour lequel generateBaseString() retomberait sur
// le placeholder générique 'string_value'.
export function isWeakStringField(schema: any, fieldName?: string): boolean {
  if (schema?.type !== 'string') return false;
  if (schema.example !== undefined) return false;
  if (schema.enum) return false;
  if (schema.format) return false; // formats standards ou date custom déjà gérés
  // minLength est traité par generateBaseString AVANT le cache : une suggestion Gemini
  // pour ce champ ne serait jamais utilisée, donc pas la peine de la demander.
  if (schema.minLength) return false;
  if (fieldName && COVERED_HEURISTICS.test(fieldName)) return false;
  return true;
}

// Un champ object "faible" est un objet à additionalProperties libres pour lequel
// generateObject() retomberait sur `{}`.
export function isWeakObjectField(schema: any): boolean {
  return (
    schema?.type === 'object' &&
    schema.additionalProperties === true && // booléen, pas un objet avec sous-schéma
    schema.example === undefined
  );
}
