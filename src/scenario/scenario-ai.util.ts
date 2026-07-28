export type SchemaFieldsContext = {
  name: string;
  description: string;
  statusCode: number;
  requestFields: string[];
  responseFields: string[];
};


export function flattenSchemaFields(schema: any, prefix = ''): string[] {
  if (!schema?.properties) return [];
  const lines: string[] = [];

  for (const [key, prop] of Object.entries<any>(schema.properties)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = prop.format ? `${prop.type}(${prop.format})` : prop.type;
    const exampleHint =
      prop.example !== undefined ? ` [exemple réel de la spec: ${JSON.stringify(prop.example)}]` : '';
    const descHint = prop.description ? ` — ${prop.description}` : '';

    lines.push(`${path}: ${type}${descHint}${exampleHint}`);

    if (prop.type === 'object' && prop.properties) {
      lines.push(...flattenSchemaFields(prop, path));
    }
  }

  return lines;
}

const SYSTEM_PROMPT = `Tu génères un scénario de test pour une API REST bancaire corporate.
Réponds UNIQUEMENT en JSON valide, sans texte autour : {"requestExample": {...}, "mockContent": {...}}

RÈGLES STRICTES :
- requestExample : respecte les champs du schéma REQUEST, cohérent avec le scénario décrit
- mockContent : respecte les champs du schéma RESPONSE, cohérent avec le scénario ET le code HTTP
  fourni (ex: un code 2xx doit décrire un SUCCÈS, jamais un contenu qui ressemble à une erreur ;
  un code 4xx/5xx doit décrire l'échec correspondant au scénario)
- Si un champ a un "exemple réel de la spec" indiqué, garde une valeur du MÊME TYPE/FORMAT que
  cet exemple (ex: un type d'instrument technique comme "CHECKBOOK") — n'adapte au thème du
  scénario QUE les champs de texte libre (motif, commentaire, message d'erreur)
- Textes lisibles en français, concis (max 15 mots par phrase)
- N'invente aucun champ hors des schémas fournis`;

export function buildPrompt(ctx: SchemaFieldsContext): string {
  return `${SYSTEM_PROMPT}

Scénario: "${ctx.name}" — ${ctx.description}
Code HTTP: ${ctx.statusCode}

Schéma REQUEST:
${ctx.requestFields.join('\n') || '(aucun)'}

Schéma RESPONSE:
${ctx.responseFields.join('\n') || '(aucun)'}`;
}


const ERROR_STATUS_VALUES = /^(error|failed|fail|rejected|denied|refused)$/i;
const ERROR_KEYWORDS = /erreur|introuvable|échec|invalide|refusé|refus|inexistant|non trouvé|not found|failed|denied/i;

export function looksLikeErrorContent(value: unknown, depth = 0): boolean {
  if (depth > 4 || value === null || value === undefined) return false;
  if (typeof value === 'string') return ERROR_KEYWORDS.test(value);
  if (Array.isArray(value)) return value.some((v) => looksLikeErrorContent(v, depth + 1));
  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/status/i.test(key) && typeof val === 'string' && ERROR_STATUS_VALUES.test(val)) return true;
      if (looksLikeErrorContent(val, depth + 1)) return true;
    }
  }
  return false;
}
