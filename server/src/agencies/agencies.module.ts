import { Module } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { AgenciesRepository } from './agencies.repository';

@Module({
  providers: [AgenciesService, AgenciesRepository],
  controllers: [AgenciesController],
  exports: [AgenciesService],
})
export class AgenciesModule {}
