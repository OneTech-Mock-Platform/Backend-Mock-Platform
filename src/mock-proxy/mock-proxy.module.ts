import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MockProxyController } from './mock-proxy.controller';
import { MockProxyService } from './mock-proxy.service';

@Module({
  imports: [PrismaModule],
  controllers: [MockProxyController],
  providers: [MockProxyService],
})
export class MockProxyModule {}
