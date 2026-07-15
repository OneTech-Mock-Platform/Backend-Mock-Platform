import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParsingService } from '../parsing/parsing.service';
import { MockDataService } from '../mock-data/mock-data.service';
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
    const created = await this.prisma.openApiSpec.create({
      data: {
        name: dto.name,
        filePath: dto.fileName,
        content: dto.content,
        userId: userId,
      },
    });

    await this.parseAndSaveEndpoints(created.id, dto.content, dto.fileName!);
    await this.generateScenarios(created.id);
    return this.toResponse(created);
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

    const updated = await this.prisma.openApiSpec.update({
      where: { id },
      data: {
        name: dto.name,
        filePath: dto.fileName ?? existing?.filePath,
        content: dto.content,
      },
    });

    await this.parseAndSaveEndpoints(updated.id, updated.content, updated.filePath);
    await this.generateScenarios(updated.id);
    return this.toResponse(updated);
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
        responses?: {
          statusCode: string;
          description: string;
          contentType?: string;
          schema?: any;
        }[]
      } | null;

      const responses = details?.responses ?? [];
      const successCodes = ['200', '201', '202'];

      const existingScenarios = await this.prisma.scenario.findMany({
        where: { endpointId: endpoint.id },
      });
      const existingStatusCodes = new Set(existingScenarios.map((s) => s.statusCode));

      for (const response of responses) {
        const statusCode = parseInt(response.statusCode, 10);
        if (existingStatusCodes.has(statusCode)) continue; // scénario déjà présent : on préserve ses personnalisations

        const mockData = response.schema
          ? this.mockDataService.generate(response.schema)
          : null;

        await this.prisma.scenario.create({
          data: {
            statusCode,
            description: response.description ?? '',
            name: `${endpoint.method} ${endpoint.path} — ${response.statusCode}`,
            isDefault: successCodes.includes(response.statusCode),
            mockContent: mockData ? JSON.stringify(mockData, null, 2) : null,
            contentType: mockData ? (response.contentType ?? 'application/json') : null,
            endpointId: endpoint.id,
          },
        });
      }
    }
  }
}