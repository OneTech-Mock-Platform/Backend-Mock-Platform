import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ParsingModule } from '../parsing/parsing.module';
import { SpecificationController } from './specification.controller';
import { SpecificationService } from './specification.service';

@Module({
  imports: [PrismaModule, ParsingModule],
  controllers: [SpecificationController],
  providers: [SpecificationService],
})
export class SpecificationModule {}
