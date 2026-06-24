export interface ParsedEndpoint {
  path: string;
  method: string;
  summary?: string;
  operationId?: string;
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