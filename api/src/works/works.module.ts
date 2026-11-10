import { Module } from '@nestjs/common';
import { ReleaseSweep } from './release/release.sweep';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  controllers: [WorksController],
  providers: [WorksService, ReleaseSweep],
  exports: [WorksService],
})
export class WorksModule {}
