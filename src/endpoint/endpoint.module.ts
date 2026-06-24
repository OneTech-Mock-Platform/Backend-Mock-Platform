import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EndpointController } from './endpoint.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EndpointController],
})
export class EndpointModule {}