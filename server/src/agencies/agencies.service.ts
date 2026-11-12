import { Injectable } from '@nestjs/common';
import { AgenciesRepository } from './agencies.repository';

@Injectable()
export class AgenciesService {
  constructor(private readonly agenciesRepository: AgenciesRepository) {}

  async findAll() {
    return await this.agenciesRepository.findAll();
  }

  findById(id: string) {
    return this.agenciesRepository.findById(id); // l'agence, ou null
  }

  findCentral() {
    return this.agenciesRepository.findCentral();
  }
}
