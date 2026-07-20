/* export interface ParsedEndpoint {
  path: string;
  method: string;
  summary?: string;
  operationId?: string;
  responses?: string[];
}

export interface ParsedSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  endpoints: ParsedEndpoint[];
}


 */



export interface ParsedResponse {
  statusCode: string;
  description: string;
  contentType?: string;
  schema?: unknown;
}

export interface ParsedParameter {
  name: string;
  in: string;       // 'query' | 'path' | 'header' | 'cookie'
  required: boolean;
  description?: string;
  schema?: unknown;
}

export interface ParsedRequestBody {
  required: boolean;
  contentType: string;
  schema?: unknown;
}

// Extensions vendor x-BbAccessControl-* (resource/function/privilege requis pour l'opération) —
// utilisées pour enrichir automatiquement le message des réponses 403 avec le vrai privilège
// et la vraie ressource attendus par l'API, au lieu d'un texte générique.
export interface ParsedAccessControl {
  resource?: string;
  function?: string;
  privilege?: string;
}

export interface ParsedEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];   // ← plus string[], maintenant objets complets
  accessControl?: ParsedAccessControl;
}

export interface ParsedSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  endpoints: ParsedEndpoint[];
}