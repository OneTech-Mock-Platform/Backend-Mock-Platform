import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EndpointController } from './endpoint.controller';
import { SpecificationModule } from '../specification/specification.module';


@Module({
  imports: [PrismaModule,SpecificationModule],
  controllers: [EndpointController],
})
export class EndpointModule {}