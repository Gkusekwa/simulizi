import { Module } from '@nestjs/common';
import { WorksModule } from '../works/works.module';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

@Module({
  imports: [WorksModule],
  controllers: [ReadingController],
  providers: [ReadingService],
})
export class ReadingModule {}
