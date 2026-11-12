import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorators';
import { AgenciesService } from './agencies.service';
import { AgencyDto } from './dto/agency.dto';

@ApiTags('Agences')
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lister les agences',
    description:
      "Renvoie toutes les agences, triées par nom. Route publique, utilisée pour choisir l'agence à contacter.",
  })
  @ApiOkResponse({
    description: 'Liste des agences',
    type: [AgencyDto.Output],
  })
  findAll() {
    return this.agenciesService.findAll();
  }
}
