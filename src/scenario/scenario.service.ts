import { Injectable, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MockDataService, isCauseDeterminable, buildAccessControlMessage } from '../mock-data/mock-data.service';
import { generateViolatingExample, parametersToObjectSchema } from '../mock-data/constraint-violation.util';
import { callGeminiJSON } from '../mock-data/gemini-client';
import { flattenSchemaFields, buildPrompt, looksLikeErrorContent } from './scenario-ai.util';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { GenerateScenarioContentDto } from './dto/generate-scenario-content.dto';

@Injectable()
export class ScenarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockDataService: MockDataService,
  ) {}

  async create(dto: CreateScenarioDto, userId: number) {
    const endpoint = await this.prisma.endpoint.findUnique({
      where: { id: dto.endpointId },
      include: { spec: true },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint ${dto.endpointId} not found`);
    }

    if (endpoint.spec.userId !== userId) {
      throw new ForbiddenException('You do not have access to this endpoint');
    }

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

    const matchingResponse = details?.responses?.find(
      (r) => parseInt(r.statusCode, 10) === dto.statusCode,
    );

    const requestExampleIsAuto = dto.requestExample === undefined;
    const mockContentIsAuto = dto.mockContent === undefined;
    const requestBodySchema = details?.requestBody?.schema;

    let requestExample: Record<string, unknown> | null =
      (dto.requestExample as Record<string, unknown> | undefined) ??
      (requestBodySchema ? (this.mockDataService.generate(requestBodySchema) as Record<string, unknown>) : null);

    let name = dto.name ?? `${endpoint.method} ${endpoint.path} — ${dto.statusCode}`;
    let violatedField: string | undefined;
    let violationMessage: string | undefined;

    if (requestExampleIsAuto && [400, 422].includes(dto.statusCode)) {
      if (requestBodySchema && requestExample) {
        const violation = generateViolatingExample(requestExample, requestBodySchema);
        if (violation) {
          requestExample = violation.example;
          if (!dto.name) name = `${dto.statusCode} — ${violation.violation}`;
          violatedField = violation.field;
          violationMessage = violation.message;
        }
      } else if (!requestBodySchema && details?.parameters?.length) {
        const parametersSchema = parametersToObjectSchema(details.parameters);
        const validParametersExample = this.mockDataService.generate(parametersSchema) as Record<string, unknown>;
        const violation = generateViolatingExample(validParametersExample, parametersSchema);
        if (violation) {
          if (!dto.name) name = `${dto.statusCode} — ${violation.violation}`;
          violatedField = violation.field;
          violationMessage = violation.message;
        }
      }
    }

    const suppressGenericErrorItems = [400, 422].includes(dto.statusCode)
      ? !violatedField
      : !isCauseDeterminable(dto.statusCode);

    const accessControlMessage = buildAccessControlMessage(details?.accessControl);

    const generatedMockData =
      !dto.mockContent && matchingResponse?.schema
        ? this.mockDataService.generate(matchingResponse.schema, 0, undefined, undefined, undefined, {
            index: 0,
            responseDescription: matchingResponse.description,
            violatedField,
            violationMessage,
            suppressGenericErrorItems,
            isSuccessResponse: [200, 201, 202].includes(dto.statusCode),
            accessControlMessage: dto.statusCode === 403 ? accessControlMessage : undefined,
          })
        : null;

    const mockContent =
      dto.mockContent ?? (generatedMockData ? JSON.stringify(generatedMockData, null, 2) : null);

    const created = await this.prisma.scenario.create({
      data: {
        statusCode: dto.statusCode,
        description: dto.description ?? matchingResponse?.description ?? '',
        name,
        isDefault: dto.isDefault ?? false,
        mockContent,
        contentType:
          dto.contentType ?? (mockContent ? matchingResponse?.contentType ?? 'application/json' : null),
        headers: dto.headers,
        requestExample: (requestExample as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        requestExampleIsAuto,
        mockContentIsAuto,
        delayMs: dto.delayMs ?? 0,
        endpointId: dto.endpointId,
      },
      include: {
        endpoint: true,
      },
    });

    return created;
  }

  async findAll(userId: number) {
    const items = await this.prisma.scenario.findMany({
      where: {
        endpoint: {
          spec: {
            userId: userId,
          },
        },
      },
      include: {
        endpoint: true,
      },
      orderBy: { id: 'desc' },
    });

    return { items };
  }

  async findOne(id: string, userId: number) {
    const item = await this.prisma.scenario.findUnique({
      where: { id },
      include: {
        endpoint: {
          include: {
            spec: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Scenario ${id} not found`);
    }

    if (item.endpoint.spec.userId !== userId) {
      throw new ForbiddenException('You do not have access to this scenario');
    }

    return item;
  }

  async findByEndpoint(endpointId: string, userId: number) {
    const endpoint = await this.prisma.endpoint.findUnique({
      where: { id: endpointId },
      include: { spec: true },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint ${endpointId} not found`);
    }

    if (endpoint.spec.userId !== userId) {
      throw new ForbiddenException('You do not have access to this endpoint');
    }

    const items = await this.prisma.scenario.findMany({
      where: { endpointId },
      include: {
        endpoint: true,
      },
      orderBy: { statusCode: 'asc' },
    });

    return { items };
  }

  async update(id: string, dto: UpdateScenarioDto, userId: number) {
    await this.ensureOwnership(id, userId);

    const updated = await this.prisma.scenario.update({
      where: { id },
      data: {
        statusCode: dto.statusCode,
        description: dto.description,
        endpointId: dto.endpointId,
        name: dto.name,
        isDefault: dto.isDefault,
        mockContent: dto.mockContent,
        contentType: dto.contentType,
        headers: dto.headers,
        requestExample: dto.requestExample as Prisma.InputJsonValue | undefined,
        requestExampleIsAuto: dto.requestExample !== undefined ? false : undefined,
        mockContentIsAuto: dto.mockContent !== undefined ? false : undefined,
        delayMs: dto.delayMs,
      },
      include: {
        endpoint: true,
      },
    });

    return updated;
  }


  async generateContentWithAI(endpointId: string, dto: GenerateScenarioContentDto, userId: number) {
    const endpoint = await this.prisma.endpoint.findUnique({
      where: { id: endpointId },
      include: { spec: true },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint ${endpointId} not found`);
    }

    if (endpoint.spec.userId !== userId) {
      throw new ForbiddenException('You do not have access to this endpoint');
    }

    const details = endpoint.responses as {
      requestBody?: { schema?: any } | null;
      responses?: { statusCode: string; schema?: any }[];
    } | null;

    const requestFields = flattenSchemaFields(details?.requestBody?.schema);
    const matchingResponse = details?.responses?.find(
      (r) => parseInt(r.statusCode, 10) === dto.statusCode,
    );
    const responseFields = flattenSchemaFields(matchingResponse?.schema);

    const prompt = buildPrompt({
      name: dto.name,
      description: dto.description,
      statusCode: dto.statusCode,
      requestFields,
      responseFields,
    });

    try {
      const result = await callGeminiJSON(prompt);
      const isSuccessCode = [200, 201, 202, 204].includes(dto.statusCode);
      const contentLooksLikeError = isSuccessCode && looksLikeErrorContent(result.mockContent);

      return {
        requestExample: result.requestExample ?? {},
        mockContent: result.mockContent ?? {},
        warning: contentLooksLikeError
          ? `Le contenu généré ressemble à une erreur, mais le code sélectionné est ${dto.statusCode}. Vérifie que c'est bien le bon code pour ce scénario.`
          : undefined,
      };
    } catch (err) {
      console.error('[generateContentWithAI] Appel Gemini échoué :', err);
      throw new ServiceUnavailableException('Génération IA indisponible pour le moment, remplis manuellement.');
    }
  }

  async remove(id: string, userId: number) {
    await this.ensureOwnership(id, userId);

    await this.prisma.scenario.delete({
      where: { id },
    });

    return { message: 'Scenario deleted successfully' };
  }

  private async ensureExists(id: string) {
    const existing = await this.prisma.scenario.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Scenario ${id} not found`);
    }

    return existing;
  }

  private async ensureOwnership(id: string, userId: number) {
    const existing = await this.ensureExists(id);

    const endpoint = await this.prisma.endpoint.findUnique({
      where: { id: existing.endpointId },
      include: { spec: true },
    });

    if (!endpoint || endpoint.spec.userId !== userId) {
      throw new ForbiddenException('You do not have access to this scenario');
    }

    return existing;
  }
}