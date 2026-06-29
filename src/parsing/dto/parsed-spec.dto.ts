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