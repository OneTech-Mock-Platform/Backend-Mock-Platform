import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OpenApiMockModule } from './openapi-mock/openapi-mock.module';

@Module({
  imports: [PrismaModule, OpenApiMockModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
