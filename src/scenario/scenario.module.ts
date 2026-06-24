import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ScenarioController],
  providers: [ScenarioService],
  exports: [ScenarioService],
})
export class ScenarioModule {}