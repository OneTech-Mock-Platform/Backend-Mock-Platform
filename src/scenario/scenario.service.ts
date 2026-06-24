import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';

@Injectable()
export class ScenarioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScenarioDto) {
    const endpoint = await this.prisma.endpoint.findUnique({
      where: { id: dto.endpointId },
    });

    if (!endpoint) {
      throw new NotFoundException(`Endpoint ${dto.endpointId} not found`);
    }

    const created = await this.prisma.scenario.create({
      data: {
        statusCode: dto.statusCode,
        description: dto.description,
        endpointId: dto.endpointId,
      },
      include: {
        endpoint: true,
      },
    });

    return created;
  }

  async findAll() {
    const items = await this.prisma.scenario.findMany({
      include: {
        endpoint: true,
      },
      orderBy: { id: 'desc' },
    });

    return { items };
  }

  async findOne(id: string) {
    const item = await this.prisma.scenario.findUnique({
      where: { id },
      include: {
        endpoint: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Scenario ${id} not found`);
    }

    return item;
  }

  async findByEndpoint(endpointId: string) {
    const items = await this.prisma.scenario.findMany({
      where: { endpointId },
      include: {
        endpoint: true,
      },
      orderBy: { statusCode: 'asc' },
    });

    return { items };
  }

  async update(id: string, dto: UpdateScenarioDto) {
    await this.ensureExists(id);

    const updated = await this.prisma.scenario.update({
      where: { id },
      data: {
        statusCode: dto.statusCode,
        description: dto.description,
        endpointId: dto.endpointId,
      },
      include: {
        endpoint: true,
      },
    });

    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);

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
}