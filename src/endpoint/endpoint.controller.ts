import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('endpoints')
export class EndpointController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('specification/:specId')
  async findBySpecification(@Param('specId') specId: string) {
    const endpoints = await this.prisma.endpoint.findMany({
      where: { specId },
      orderBy: [{ method: 'asc' }, { path: 'asc' }],
    });

    return { items: endpoints };
  }
}