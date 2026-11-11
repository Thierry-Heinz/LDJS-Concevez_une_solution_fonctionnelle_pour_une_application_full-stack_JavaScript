import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorators';
import { AgenciesService } from './agencies.service';

@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Public()
  @Get()
  findAll() {
    return this.agenciesService.findAll();
  }
}
