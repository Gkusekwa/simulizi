import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ReleaseSweep } from './release/release.sweep';
import { StatsService } from './stats.service';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  controllers: [WorksController],
  providers: [WorksService, ReleaseSweep, StatsService, ExportService],
  exports: [WorksService],
})
export class WorksModule {}
