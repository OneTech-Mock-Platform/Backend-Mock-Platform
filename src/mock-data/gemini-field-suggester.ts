/* import type { WeakField } from './weak-field-collector';
import { callGeminiJSON } from './gemini-client';

const BATCH_SIZE = 100;

const SYSTEM_PROMPT = `Tu es un générateur de données de test (mock data) pour une API REST.
Je vais te donner une liste de champs issus d'un schéma OpenAPI, pour lesquels
aucun exemple n'est fourni dans la spécification. Pour chacun, génère UNE valeur
plausible et réaliste, cohérente avec son nom, son type et sa description.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un objet JSON valide, rien d'autre : pas de texte
  avant, pas de texte après, pas de balises markdown, pas de \`\`\`json.
- Les clés de l'objet JSON de sortie doivent être EXACTEMENT les "id" fournis
  en entrée (pas les noms de champs, pour éviter toute ambiguïté en cas de doublon).
- Le domaine métier est une API bancaire corporate (gestion de chéquiers, POS,
  approbations de demandes). Les valeurs doivent être plausibles dans ce contexte.
- Pour les champs de type "string" : une chaîne de caractères courte et réaliste,
  en français si le champ est un texte métier lisible par un humain (nom, motif,
  commentaire...), sans traduction si c'est un identifiant technique.
- Pour les champs de type "object" (additionalProperties) : un petit objet JSON
  avec 2-4 clés plausibles et leurs valeurs, cohérent avec le nom du champ.
- Ne jamais inventer un texte qui ressemble à un message d'erreur générique
  ("erreur", "problème", "invalide") sauf si le nom du champ l'indique clairement.
- Reste concis : pas de phrases de plus de 15 mots pour les champs texte.`;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function suggestFieldValues(fields: WeakField[]): Promise<Record<string, unknown>> {
  if (fields.length === 0) return {};

  const results: Record<string, unknown> = {};

  for (const batch of chunk(fields, BATCH_SIZE)) {
    const payload = {
      fields: batch.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        description: f.description ?? '',
        parentSchema: f.parentSchema,
      })),
    };

    const parsed = await callGeminiJSON(
      `${SYSTEM_PROMPT}\n\nChamps à traiter :\n${JSON.stringify(payload, null, 2)}`,
    );

    for (const field of batch) {
      if (Object.prototype.hasOwnProperty.call(parsed, field.id)) {
        results[field.id] = parsed[field.id];
      } else {
        console.warn(`[fields:refresh] Aucune suggestion Gemini pour "${field.name}" (id=${field.id}).`);
      }
    }
  }

  return results;
}
 */


import type { WeakField } from './weak-field-collector';
import { callGeminiJSON } from './gemini-client';

const BATCH_SIZE = 100;

function buildSystemPrompt(domainHint?: string): string {
  const domainLine = domainHint
    ? `Le domaine métier est : ${domainHint}. Les valeurs doivent être plausibles dans ce contexte précis.`
    : `Le domaine métier n'est pas précisé — reste générique et plausible, sans supposer de secteur particulier.`;

  return `Tu es un générateur de données de test (mock data) pour une API REST.
Je vais te donner une liste de champs issus d'un schéma OpenAPI, pour lesquels
aucun exemple n'est fourni dans la spécification. Pour chacun, génère UNE valeur
plausible et réaliste, cohérente avec son nom, son type et sa description.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un objet JSON valide, rien d'autre : pas de texte
  avant, pas de texte après, pas de balises markdown, pas de \`\`\`json.
- Les clés de l'objet JSON de sortie doivent être EXACTEMENT les "id" fournis
  en entrée (pas les noms de champs, pour éviter toute ambiguïté en cas de doublon).
- ${domainLine}
- Pour les champs de type "string" : une chaîne de caractères courte et réaliste,
  en français si le champ est un texte métier lisible par un humain (nom, motif,
  commentaire...), sans traduction si c'est un identifiant technique.
- Pour les champs de type "object" (additionalProperties) : un petit objet JSON
  avec 2-4 clés plausibles et leurs valeurs, cohérent avec le nom du champ.
- Ne jamais inventer un texte qui ressemble à un message d'erreur générique
  ("erreur", "problème", "invalide") sauf si le nom du champ l'indique clairement.
- Reste concis : pas de phrases de plus de 15 mots pour les champs texte.`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function suggestFieldValues(
  fields: WeakField[],
  domainHint?: string,
): Promise<Record<string, unknown>> {
  if (fields.length === 0) return {};

  const results: Record<string, unknown> = {};
  const systemPrompt = buildSystemPrompt(domainHint);

  for (const batch of chunk(fields, BATCH_SIZE)) {
    const payload = {
      fields: batch.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        description: f.description ?? '',
        parentSchema: f.parentSchema,
      })),
    };

    const parsed = await callGeminiJSON(
      `${systemPrompt}\n\nChamps à traiter :\n${JSON.stringify(payload, null, 2)}`,
    );

    for (const field of batch) {
      if (Object.prototype.hasOwnProperty.call(parsed, field.id)) {
        results[field.id] = parsed[field.id];
      } else {
        console.warn(`[fields:refresh] Aucune suggestion Gemini pour "${field.name}" (id=${field.id}).`);
      }
    }
  }

  return results;
}