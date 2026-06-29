import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParsingService } from '../parsing/parsing.service';
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
  ) {}

  async create(dto: CreateSpecificationDto) {
    const created = await this.prisma.openApiSpec.create({
      data: {
        name: dto.name,
        filePath: dto.fileName,
        content: dto.content,
      },
    });

    await this.parseAndSaveEndpoints(created.id, dto.content, dto.fileName!);

    return this.toResponse(created);
  }

  async findAll() {
    const items = await this.prisma.openApiSpec.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.map((item) => this.toResponse(item)),
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.openApiSpec.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Specification ${id} not found`);
    }

    return this.toResponse(item);
  }

  async update(id: string, dto: UpdateSpecificationDto) {
    await this.ensureExists(id);

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

    return this.toResponse(updated);
  }

  async remove(id: string) {
    await this.ensureExists(id);

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
/* 
  private async parseAndSaveEndpoints(specId: string, content: string, fileName: string) {
    const parsed = this.parsingService.parse(content, fileName);

    await this.prisma.endpoint.deleteMany({
      where: { specId },
    });

    if (parsed.endpoints.length > 0) {
      await this.prisma.endpoint.createMany({
        data: parsed.endpoints.map((endpoint) => ({
          specId,
          path: endpoint.path,
          method: endpoint.method,
          summary: endpoint.summary,
          responses: endpoint.responses,
        })),
      });
    }
  }
 */

  private async parseAndSaveEndpoints(
  specId: string,
  content: string,
  fileName: string,
) {
  const parsed = this.parsingService.parse(content, fileName);

  await this.prisma.endpoint.deleteMany({ where: { specId } });

  for (const ep of parsed.endpoints) {
    await this.prisma.endpoint.create({
      data: {
        specId,
        path: ep.path,
        method: ep.method,
        summary: ep.summary ?? null,
        // ← On stocke TOUT ici dans le champ Json?
     /*    responses: {
          description: ep.description ?? null,
          operationId: ep.operationId ?? null,
          tags: ep.tags,
          parameters: ep.parameters,
          requestBody: ep.requestBody ?? null,
          responses: ep.responses,
        }, */

        responses: {
  description: ep.description ?? null,
  operationId: ep.operationId ?? null,
  tags: ep.tags,
  parameters: JSON.parse(JSON.stringify(ep.parameters)),
  requestBody: ep.requestBody
    ? JSON.parse(JSON.stringify(ep.requestBody))
    : null,
  responses: JSON.parse(JSON.stringify(ep.responses)),
},
      },
    });
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
}
