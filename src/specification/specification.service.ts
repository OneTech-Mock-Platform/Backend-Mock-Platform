import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParsingService } from '../parsing/parsing.service';
import { MockDataService, isCauseDeterminable, buildAccessControlMessage } from '../mock-data/mock-data.service';
import { generateViolatingExample, parametersToObjectSchema } from '../mock-data/constraint-violation.util';
import { collectWeakFields } from '../mock-data/weak-field-collector';
import { suggestFieldValues } from '../mock-data/gemini-field-suggester';
import { patchWeakValues } from '../mock-data/weak-value-patcher';
import { CreateSpecificationDto } from './dto/create-specification.dto';
import { UpdateSpecificationDto } from './dto/update-specification.dto';

type SpecificationSummary = {
  endpointCount: number;
  operationCount: number;
};

@Injectable()
export class SpecificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parsingService: ParsingService,
    private readonly mockDataService: MockDataService, 
  ) {}

  async create(dto: CreateSpecificationDto, userId: number) {
    await this.parsingService.parse(dto.content, dto.fileName!);

    const created = await this.prisma.openApiSpec.create({
      data: {
        name: dto.name,
        filePath: dto.fileName,
        content: dto.content,
        userId: userId,
      },
    });

    await this.parseAndSaveEndpoints(created.id, dto.content, dto.fileName!);
    await this.refreshFieldSuggestions(created.id);
    await this.generateScenarios(created.id);

  
    const warnings = await this.parsingService.validateStrict(created.content, created.filePath);

    return { ...this.toResponse(created), warnings };
  }

  async findAll(userId: number) {
    const items = await this.prisma.openApiSpec.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.map((item) => this.toResponse(item)),
    };
  }

  async findOne(id: string, userId: number) {
    const item = await this.prisma.openApiSpec.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Specification ${id} not found`);
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have access to this specification');
    }

    return this.toResponse(item);
  }

  async update(id: string, dto: UpdateSpecificationDto, userId: number) {
    await this.ensureOwnership(id, userId);

    const existing = await this.prisma.openApiSpec.findUnique({ where: { id } });
    const fileName = dto.fileName ?? existing!.filePath;
    const content = dto.content ?? existing!.content;

    await this.parsingService.parse(content, fileName);

    const updated = await this.prisma.openApiSpec.update({
      where: { id },
      data: {
        name: dto.name,
        filePath: fileName,
        content,
      },
    });

    await this.parseAndSaveEndpoints(updated.id, updated.content, updated.filePath);
    await this.refreshFieldSuggestions(updated.id);
    await this.generateScenarios(updated.id);

    const warnings = await this.parsingService.validateStrict(updated.content, updated.filePath);

    return { ...this.toResponse(updated), warnings };
  }

  async remove(id: string, userId: number) {
    await this.ensureOwnership(id, userId);

    await this.prisma.openApiSpec.delete({
      where: { id },
    });

    return { message: 'Specification deleted successfully' };
  }

  private async ensureExists(id: string) {
    const existing = await this.prisma.openApiSpec.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Specification ${id} not found`);
    }

    return existing;
  }

  private async ensureOwnership(id: string, userId: number) {
    const existing = await this.ensureExists(id);

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have access to this specification');
    }

    return existing;
  }

  private async parseAndSaveEndpoints(
    specId: string,
    content: string,
    fileName: string,
  ) {

    const parsed = await this.parsingService.parse(content, fileName);

    const existingEndpoints = await this.prisma.endpoint.findMany({ where: { specId } });
    const existingByKey = new Map(
      existingEndpoints.map((e) => [`${e.path}::${e.method}`, e]),
    );
    const seenKeys = new Set<string>();

    for (const ep of parsed.endpoints) {
      const key = `${ep.path}::${ep.method}`;
      seenKeys.add(key);

      const responsesData = {
        description: ep.description ?? null,
        operationId: ep.operationId ?? null,
        tags: ep.tags,
        parameters: JSON.parse(JSON.stringify(ep.parameters)),
        requestBody: ep.requestBody
          ? JSON.parse(JSON.stringify(ep.requestBody))
          : null,
        responses: JSON.parse(JSON.stringify(ep.responses)),
        accessControl: ep.accessControl
          ? JSON.parse(JSON.stringify(ep.accessControl))
          : null,
      };

      const existing = existingByKey.get(key);
      if (existing) {
        await this.prisma.endpoint.update({
          where: { id: existing.id },
          data: {
            summary: ep.summary ?? null,
            responses: responsesData,
          },
        });
      } else {
        await this.prisma.endpoint.create({
          data: {
            specId,
            path: ep.path,
            method: ep.method,
            summary: ep.summary ?? null,
            responses: responsesData,
          },
        });
      }
    }

    const staleEndpointIds = existingEndpoints
      .filter((e) => !seenKeys.has(`${e.path}::${e.method}`))
      .map((e) => e.id);

    if (staleEndpointIds.length) {
      await this.prisma.endpoint.deleteMany({ where: { id: { in: staleEndpointIds } } });
    }
  }

  private async refreshFieldSuggestions(specId: string) {
    try {
      const weakFields = await collectWeakFields(this.prisma, specId);
      const uncached = weakFields.filter((f) => !this.mockDataService.hasSuggestion(f.id));

      if (uncached.length === 0) return;

      const suggestions = await suggestFieldValues(uncached);

      for (const field of uncached) {
        if (!Object.prototype.hasOwnProperty.call(suggestions, field.id)) continue;
        await this.prisma.fieldSuggestion.upsert({
          where: { fieldKey: field.id },
          create: {
            fieldKey: field.id,
            fieldName: field.name,
            fieldType: field.type,
            value: suggestions[field.id] as Prisma.InputJsonValue,
            source: 'gemini',
          },
          update: {
            value: suggestions[field.id] as Prisma.InputJsonValue,
          },
        });
      }

      await this.mockDataService.reloadSuggestionCache();
    } catch (err) {
      console.error('[IA] Génération de suggestions échouée, poursuite avec fallback générique', err);
    }
  }

  private toResponse(item: { id: string; name: string; filePath: string; content: string; createdAt: Date }) {
    const summary = this.summarizeContent(item.content);
    const fileFormat = this.resolveFormat(item.filePath);

    return {
      id: item.id,
      name: item.name,
      fileName: item.filePath,
      format: fileFormat,
      content: item.content,
      createdAt: item.createdAt,
      size: item.content.length,
      summary,
    };
  }

  private resolveFormat(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'yaml' || extension === 'yml') {
      return 'yaml';
    }

    return 'json';
  }

  private summarizeContent(content: string): SpecificationSummary {
    const endpointCount = (content.match(/^[\s\t]{2}\/[^:\n]+:/gm) ?? []).length;
    const operationCount =
      (content.match(/^[\s\t]{4}(get|post|put|delete|patch|options|head|trace):/gim) ?? []).length;

    return {
      endpointCount,
      operationCount,
    };
  }


  private async generateScenarios(specId: string) {
    const endpoints = await this.prisma.endpoint.findMany({
      where: { specId },
    });

    for (const endpoint of endpoints) {
      const details = endpoint.responses as {
        requestBody?: { schema?: any } | null;
        parameters?: { name: string; required?: boolean; schema?: any }[];
        responses?: {
          statusCode: string;
          description: string;
          contentType?: string;
          schema?: any;
        }[];
        accessControl?: { resource?: string; function?: string; privilege?: string } | null;
      } | null;

      const responses = details?.responses ?? [];
      const successCodes = ['200', '201', '202'];

      const accessControlMessage = buildAccessControlMessage(details?.accessControl);

      const requestBodySchema = details?.requestBody?.schema;
      const validRequestExample = requestBodySchema
        ? (this.mockDataService.generate(requestBodySchema) as Record<string, unknown>)
        : null;

      const parametersSchema = !requestBodySchema && details?.parameters?.length
        ? parametersToObjectSchema(details.parameters)
        : undefined;
      const validParametersExample = parametersSchema
        ? (this.mockDataService.generate(parametersSchema) as Record<string, unknown>)
        : null;

      const existingScenarios = await this.prisma.scenario.findMany({
        where: { endpointId: endpoint.id },
      });
      const existingStatusCodes = new Set(existingScenarios.map((s) => s.statusCode));

      for (const response of responses) {
        const statusCode = parseInt(response.statusCode, 10);
        if (existingStatusCodes.has(statusCode)) continue; 

        let requestExample: Record<string, unknown> | null = validRequestExample;
        let name = `${endpoint.method} ${endpoint.path} — ${response.statusCode}`;
        let violatedField: string | undefined;
        let violationMessage: string | undefined;

        if (['400', '422'].includes(response.statusCode)) {
          if (requestBodySchema && validRequestExample) {
            const violation = generateViolatingExample(validRequestExample, requestBodySchema);
            if (violation) {
              requestExample = violation.example;
              name = `${response.statusCode} — ${violation.violation}`;
              violatedField = violation.field;
              violationMessage = violation.message;
            }
          } else if (parametersSchema && validParametersExample) {
           
            const violation = generateViolatingExample(validParametersExample, parametersSchema);
            if (violation) {
              name = `${response.statusCode} — ${violation.violation}`;
              violatedField = violation.field;
              violationMessage = violation.message;
            }
          }
        }

       
        const suppressGenericErrorItems = ['400', '422'].includes(response.statusCode)
          ? !violatedField
          : !isCauseDeterminable(statusCode);

        const mockData = response.schema
          ? this.mockDataService.generate(response.schema, 0, undefined, undefined, undefined, {
              index: 0,
              responseDescription: response.description,
              violatedField,
              violationMessage,
              suppressGenericErrorItems,
              isSuccessResponse: successCodes.includes(response.statusCode),
              accessControlMessage: statusCode === 403 ? accessControlMessage : undefined,
            })
          : null;

        await this.prisma.scenario.create({
          data: {
            statusCode,
            description: response.description ?? '',
            name,
            isDefault: successCodes.includes(response.statusCode),
            mockContent: mockData ? JSON.stringify(mockData, null, 2) : null,
            contentType: mockData ? (response.contentType ?? 'application/json') : null,
            requestExample: (requestExample as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            requestExampleIsAuto: true,
            endpointId: endpoint.id,
          },
        });
      }
    }
  }

  async regenerateScenarios(specId: string) {
    const endpoints = await this.prisma.endpoint.findMany({ where: { specId } });
    let patchedCount = 0;

    for (const endpoint of endpoints) {
      const details = endpoint.responses as {
        requestBody?: { schema?: any } | null;
        parameters?: { name: string; required?: boolean; schema?: any }[];
        responses?: { statusCode: string; description: string; contentType?: string; schema?: any }[];
      } | null;
      if (!details) continue;

      const requestBodySchema = details.requestBody?.schema;
      const parametersSchema = !requestBodySchema && details.parameters?.length
        ? parametersToObjectSchema(details.parameters)
        : undefined;
      const requestSchema = requestBodySchema ?? parametersSchema;

      const scenarios = await this.prisma.scenario.findMany({ where: { endpointId: endpoint.id } });

      for (const scenario of scenarios) {
        const matchingResponse = details.responses?.find(
          (r) => parseInt(r.statusCode, 10) === scenario.statusCode,
        );
        const updates: Prisma.ScenarioUpdateInput = {};
        const getSuggestion = (key: string) => this.mockDataService.getSuggestion(key);

        if (scenario.requestExampleIsAuto && scenario.requestExample && requestSchema) {
          const patched = patchWeakValues(scenario.requestExample, requestSchema, getSuggestion);
          if (JSON.stringify(patched) !== JSON.stringify(scenario.requestExample)) {
            updates.requestExample = patched as Prisma.InputJsonValue;
          }
        }

        if (scenario.mockContentIsAuto && scenario.mockContent && matchingResponse?.schema) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(scenario.mockContent);
          } catch {
            parsed = undefined;
          }
          if (parsed !== undefined) {
            const patched = patchWeakValues(parsed, matchingResponse.schema, getSuggestion);
            const patchedString = JSON.stringify(patched, null, 2);
            if (patchedString !== scenario.mockContent) {
              updates.mockContent = patchedString;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.prisma.scenario.update({ where: { id: scenario.id }, data: updates });
          patchedCount += 1;
        }
      }
    }

    return patchedCount;
  }
}