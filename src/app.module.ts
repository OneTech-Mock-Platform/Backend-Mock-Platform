import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OpenApiMockModule } from './openapi-mock/openapi-mock.module';
import { SpecificationModule } from './specification/specification.module';
import { ScenarioModule } from './scenario/scenario.module';
import { MockDataModule } from './mock-data/mock-data.module';
import { EndpointModule } from './endpoint/endpoint.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, OpenApiMockModule, SpecificationModule, ScenarioModule, MockDataModule, EndpointModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
