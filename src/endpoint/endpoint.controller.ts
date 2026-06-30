import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SpecificationService } from '../specification/specification.service';

@Controller('endpoints')
@UseGuards(JwtAuthGuard)
export class EndpointController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly specificationService: SpecificationService,
  ) {}

  @Get('specification/:specId')
  async findBySpecification(@Param('specId') specId: string, @Request() req: any) {
    // Verify the user owns this specification
    await this.specificationService.findOne(specId, req.user.id);

    const endpoints = await this.prisma.endpoint.findMany({
      where: { specId },
      orderBy: [{ method: 'asc' }, { path: 'asc' }],
    });

    return { items: endpoints };
  }
}