export type OpenApiImportSummary = {
  endpointCount: number;
  operationCount: number;
  scenarioCount: number;
};

export type OpenApiImportRecord = {
  id: string;
  fileName: string;
  format: 'yaml' | 'yml' | 'json';
  size: number;
  importedAt: string;
  summary: OpenApiImportSummary;
};

export type OpenApiWorkspaceOverview = {
  status: string;
  version: string;
  message: string;
  summary: {
    endpoints: number;
    imports: number;
    scenarios: number;
  };
};