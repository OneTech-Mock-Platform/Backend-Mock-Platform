import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public/specs')
export class PublicMockController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':specId')
  async getSpecInfo(@Param('specId') specId: string) {
    const spec = await this.prisma.openApiSpec.findUnique({
      where: { id: specId },
      select: { id: true, name: true },
    });
    if (!spec) throw new NotFoundException('Spécification introuvable.');
    return spec;
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
          select: { id: true, statusCode: true, name: true, isDefault: true, requestExample: true },
        },
      },
      orderBy: [{ method: 'asc' }, { path: 'asc' }],
    });
    return { items: endpoints };
  }
}
