import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicMockController } from './public-mock.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicMockController],
})
export class PublicMockModule {}
