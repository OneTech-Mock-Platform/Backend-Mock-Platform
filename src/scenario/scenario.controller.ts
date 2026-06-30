import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('scenarios')
@UseGuards(JwtAuthGuard)
export class ScenarioController {
  constructor(
    private readonly scenarioService: ScenarioService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(@Body() createScenarioDto: CreateScenarioDto, @Request() req: any) {
    return this.scenarioService.create(createScenarioDto, req.user.id);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.scenarioService.findAll(req.user.id);
  }

  @Get('endpoint/:endpointId')
  findByEndpoint(@Param('endpointId') endpointId: string, @Request() req: any) {
    return this.scenarioService.findByEndpoint(endpointId, req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.scenarioService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateScenarioDto: UpdateScenarioDto, @Request() req: any) {
    return this.scenarioService.update(id, updateScenarioDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.scenarioService.remove(id, req.user.id);
  }
}