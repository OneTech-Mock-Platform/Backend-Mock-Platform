import { Body, Controller, Get, Post } from '@nestjs/common';
import { OpenApiMockService } from './openapi-mock.service';
import { OpenApiImportDto } from './dto/openapi-import.dto';

@Controller('api/mock')
export class OpenApiMockController {
  constructor(private readonly openApiMockService: OpenApiMockService) {}

  @Get('overview')
  getOverview() {
    return this.openApiMockService.getOverview();
  }

  @Get('imports')
  listImports() {
    return this.openApiMockService.listImports();
  }

  @Post('import')
  importSpecification(@Body() dto: OpenApiImportDto) {
    return this.openApiMockService.importSpecification(dto);
  }
}