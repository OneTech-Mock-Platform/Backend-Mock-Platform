import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { SpecificationService } from './specification.service';
import { CreateSpecificationDto } from './dto/create-specification.dto';
import { UpdateSpecificationDto } from './dto/update-specification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('specifications')
@UseGuards(JwtAuthGuard)
export class SpecificationController {
	constructor(
		private readonly specificationService: SpecificationService,
		private readonly prisma: PrismaService,
	) {}

	@Get()
	findAll(@Request() req: any) {
		return this.specificationService.findAll(req.user.id);
	}

	@Get(':id')
	findOne(@Param('id') id: string, @Request() req: any) {
		return this.specificationService.findOne(id, req.user.id);
	}

	@Get(':id/endpoints')
	async findEndpoints(@Param('id') id: string, @Request() req: any) {
		// Verify ownership first
		await this.specificationService.findOne(id, req.user.id);

		const endpoints = await this.prisma.endpoint.findMany({
			where: { specId: id },
			orderBy: [{ method: 'asc' }, { path: 'asc' }],
		});
		return { items: endpoints };
	}

	@Post()
	create(@Body() dto: CreateSpecificationDto, @Request() req: any) {
		return this.specificationService.create(dto, req.user.id);
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateSpecificationDto, @Request() req: any) {
		return this.specificationService.update(id, dto, req.user.id);
	}

	@Delete(':id')
	remove(@Param('id') id: string, @Request() req: any) {
		return this.specificationService.remove(id, req.user.id);
	}
}