import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SpecificationService } from './specification.service';
import { CreateSpecificationDto } from './dto/create-specification.dto';
import { UpdateSpecificationDto } from './dto/update-specification.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('specifications')
export class SpecificationController {
	constructor(
		private readonly specificationService: SpecificationService,
		private readonly prisma: PrismaService,
	) {}

	@Get()
	findAll() {
		return this.specificationService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.specificationService.findOne(id);
	}

	@Get(':id/endpoints')
	async findEndpoints(@Param('id') id: string) {
		const endpoints = await this.prisma.endpoint.findMany({
			where: { specId: id },
			orderBy: [{ method: 'asc' }, { path: 'asc' }],
		});
		return { items: endpoints };
	}

	@Post()
	create(@Body() dto: CreateSpecificationDto) {
		return this.specificationService.create(dto);
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateSpecificationDto) {
		return this.specificationService.update(id, dto);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.specificationService.remove(id);
	}
}
