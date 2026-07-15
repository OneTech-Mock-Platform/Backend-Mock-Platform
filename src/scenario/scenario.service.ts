import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockDataService } from '../mock-data/mock-data.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';

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
      responses?: {
        statusCode: string;
        description: string;
        contentType?: string;
        schema?: any;
      }[];
    } | null;

    const matchingResponse = details?.responses?.find(
      (r) => parseInt(r.statusCode, 10) === dto.statusCode,
    );

    const generatedMockData =
      !dto.mockContent && matchingResponse?.schema
        ? this.mockDataService.generate(matchingResponse.schema)
        : null;

    const mockContent =
      dto.mockContent ?? (generatedMockData ? JSON.stringify(generatedMockData, null, 2) : null);

    const created = await this.prisma.scenario.create({
      data: {
        statusCode: dto.statusCode,
        description: dto.description ?? matchingResponse?.description ?? '',
        name: dto.name ?? `${endpoint.method} ${endpoint.path} — ${dto.statusCode}`,
        isDefault: dto.isDefault ?? false,
        mockContent,
        contentType:
          dto.contentType ?? (mockContent ? matchingResponse?.contentType ?? 'application/json' : null),
        headers: dto.headers,
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
        delayMs: dto.delayMs,
      },
      include: {
        endpoint: true,
      },
    });

    return updated;
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