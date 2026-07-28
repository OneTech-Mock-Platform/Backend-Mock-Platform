import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { GenerateScenarioContentDto } from './dto/generate-scenario-content.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scenarios')
@UseGuards(JwtAuthGuard)
export class ScenarioController {
  constructor(private readonly scenarioService: ScenarioService) {}

  @Post()
  create(@Body() createScenarioDto: CreateScenarioDto, @Request() req: any) {
    return this.scenarioService.create(createScenarioDto, req.user.id);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.scenarioService.findAll(req.user.id);
  }

 // Route principale : scénarios d'un endpoint
  @Get('endpoint/:endpointId')
  async findByEndpoint(@Param('endpointId') endpointId: string, @Request() req: any) {
    return this.scenarioService.findByEndpoint(endpointId, req.user.id);
  }

  // Pré-remplissage IA du formulaire "Nouveau scénario" (ne sauvegarde rien) : voir
  // scenario.service.ts#generateContentWithAI et scenario-ai.util.ts pour le prompt.
  @Post('endpoint/:endpointId/generate-with-ai')
  async generateWithAI(
    @Param('endpointId') endpointId: string,
    @Body() dto: GenerateScenarioContentDto,
    @Request() req: any,
  ) {
    return this.scenarioService.generateContentWithAI(endpointId, dto, req.user.id);
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