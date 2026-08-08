import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public/specs')
export class PublicMockController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':specId')
  async getSpecInfo(@Param('specId') specId: string) {
    const spec = await this.prisma.openApiSpec.findUnique({
      where: { id: specId },
      select: { id: true, name: true, filePath: true, content: true },
    });
    if (!spec) throw new NotFoundException('Spécification introuvable.');

   
    let version: string | undefined;
    let description: string | undefined;
    try {
      const isYaml = /\.ya?ml$/i.test(spec.filePath);
      const raw = (isYaml ? yaml.load(spec.content) : JSON.parse(spec.content)) as {
        info?: { version?: string; description?: string };
      };
      version = raw.info?.version;
      description = raw.info?.description;
    } catch {
   
    }

    return { id: spec.id, name: spec.name, version, description };
  }

  @Get(':specId/endpoints')
  async getSpecEndpoints(@Param('specId') specId: string) {
    const endpoints = await this.prisma.endpoint.findMany({
      where: { specId },
      select: {
        id: true,
        path: true,
        method: true,
        summary: true,
        responses: true,
        scenarios: {
          select: { id: true, statusCode: true, name: true, description: true, isDefault: true, requestExample: true, delayMs: true },
        },
      },
      orderBy: [{ method: 'asc' }, { path: 'asc' }],
    });
    return { items: endpoints };
  }
}
