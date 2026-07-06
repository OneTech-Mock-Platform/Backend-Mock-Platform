import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ParsingModule } from '../parsing/parsing.module';
import { AuthModule } from '../auth/auth.module';
import { MockDataModule } from '../mock-data/mock-data.module';
import { SpecificationController } from './specification.controller';
import { SpecificationService } from './specification.service';

@Module({
  imports: [PrismaModule, ParsingModule, AuthModule, MockDataModule],
  controllers: [SpecificationController],
  providers: [SpecificationService],
  exports: [SpecificationService],
})
export class SpecificationModule {}
