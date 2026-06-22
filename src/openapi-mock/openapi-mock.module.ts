import { Module } from '@nestjs/common';
import { OpenApiMockController } from './openapi-mock.controller';
import { OpenApiMockService } from './openapi-mock.service';

@Module({
  controllers: [OpenApiMockController],
  providers: [OpenApiMockService],
})
export class OpenApiMockModule {}