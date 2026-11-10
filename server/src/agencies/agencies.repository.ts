import { Injectable } from '@nestjs/common';
import { AgencyType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgenciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return await this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return await this.prisma.agency.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        agencyType: true,
      },
    });
  }

  findCentral() {
    return this.prisma.agency.findFirst({
      where: { agencyType: AgencyType.CENTRAL },
      select: { id: true, name: true, agencyType: true },
    });
  }
}
