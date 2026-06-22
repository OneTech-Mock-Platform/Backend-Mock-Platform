import { Injectable } from '@nestjs/common';
import { OpenApiImportDto } from './dto/openapi-import.dto';
import { OpenApiImportRecord, OpenApiWorkspaceOverview } from './dto/openapi-mock.models';

@Injectable()
export class OpenApiMockService {
  private readonly imports: OpenApiImportRecord[] = [];

  getOverview(): OpenApiWorkspaceOverview {
    return {
      status: 'READY',
      version: 'v0.1',
      message: 'OneTech OpenAPI mock workspace is ready.',
      summary: {
        endpoints: this.getTotalEndpoints(),
        imports: this.imports.length,
        scenarios: 3,
      },
    };
  }

  listImports() {
    return {
      items: this.imports,
    };
  }

  importSpecification(dto: OpenApiImportDto) {
    const summary = this.summarizeContent(dto.content);
    const record: OpenApiImportRecord = {
      id: crypto.randomUUID(),
      fileName: dto.fileName,
      format: dto.format,
      size: dto.content.length,
      importedAt: new Date().toISOString(),
      summary,
    };

    this.imports.unshift(record);

    return {
      message: `Fichier ${dto.fileName} importé avec succès.`,
      overview: this.getOverview(),
      imports: this.imports,
      latestImport: record,
    };
  }

  private getTotalEndpoints() {
    return this.imports.reduce((total, item) => total + item.summary.endpointCount, 0);
  }

  private summarizeContent(content: string) {
    const endpointCount = (content.match(/^\s{2}\/[^:\n]+:/gm) ?? []).length;
    const operationCount =
      (content.match(/^\s{4}(get|post|put|delete|patch|options|head|trace):/gim) ?? []).length;

    return {
      endpointCount,
      operationCount,
      scenarioCount: Math.max(3, operationCount),
    };
  }
}