import { Injectable } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { CreateCustomerData } from './accounts.types';

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  createCustomer(data: CreateCustomerData) {
    return this.accountsRepository.createCustomer(data);
  }

  findByEmail(email: string) {
    return this.accountsRepository.findByEmail(email);
  }

  getPasswordHash(id: string) {
    return this.accountsRepository.getPasswordHash(id);
  }
}
