import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MockDataModule } from '../mock-data/mock-data.module';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';

@Module({
  imports: [PrismaModule, MockDataModule],
  controllers: [ScenarioController],
  providers: [ScenarioService],
  exports: [ScenarioService],
})
export class ScenarioModule {}