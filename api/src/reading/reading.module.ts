import { Module } from '@nestjs/common';
import { WorksModule } from '../works/works.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';
import { SearchService } from './search.service';

@Module({
  imports: [WorksModule, ModerationModule],
  controllers: [ReadingController],
  providers: [ReadingService, SearchService],
})
export class ReadingModule {}
