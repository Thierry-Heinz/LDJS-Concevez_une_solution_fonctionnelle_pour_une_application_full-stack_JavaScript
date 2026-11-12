import { Injectable } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { CreateCustomerData, UserProfile } from './accounts.types';

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  createCustomer(data: CreateCustomerData) {
    return this.accountsRepository.createCustomer(data);
  }

  findByEmail(email: string) {
    return this.accountsRepository.findByEmail(email);
  }

  findById(id: string) {
    return this.accountsRepository.findById(id);
  }

  /**
   * @returns le profil affichable de l'utilisateur (prénom et nom à `null`
   * pour un agent), ou `null` si le compte n'existe pas.
   */
  async getProfile(id: string) {
    const profile = await this.accountsRepository.findProfileById(id);
    if (!profile) {
      return null;
    }
    const customerData: UserProfile = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      firstName: profile.customer?.firstName || null,
      lastName: profile.customer?.lastName || null,
    };
    return customerData;
  }

  getPasswordHash(id: string) {
    return this.accountsRepository.getPasswordHash(id);
  }
}
