import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCustomerData } from './accounts.types';

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(data: CreateCustomerData) {
    await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: 'CUSTOMER',
        customer: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            birthDate: data.birthDate,
            address: data.address,
          },
        },
      },
    });
  }
}
