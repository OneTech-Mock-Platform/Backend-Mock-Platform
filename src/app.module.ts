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
import { ConfigModule } from '@nestjs/config';
import { MockProxyModule } from './mock-proxy/mock-proxy.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PublicMockModule } from './public-mock/public-mock.module';


@Module({
  imports: [ ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,

    }),
PrismaModule, OpenApiMockModule,
    SpecificationModule, ScenarioModule,
    MockDataModule, EndpointModule,
    AuthModule, MockProxyModule, DashboardModule,
    PublicMockModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
