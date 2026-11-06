import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

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
      },
    });
  }
}
