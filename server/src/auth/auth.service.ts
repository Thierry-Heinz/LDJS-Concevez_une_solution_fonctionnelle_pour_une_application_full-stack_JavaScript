import { Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(private readonly accountsService: AccountsService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password);
    return this.accountsService.createCustomer({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      birthDate: dto.birthDate,
      address: dto.address,
    });
  }
}
