import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRefreshTokenData } from './auth.types';

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateRefreshTokenData) {
    await this.prisma.refreshToken.create({ data });
  }

  async findById(jti: string) {
    return await this.prisma.refreshToken.findUnique({
      where: { id: jti },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
        familyId: true,
        sessionExpiresAt: true,
        userId: true,
        tokenHash: true,
      },
    });
  }

  async revokeFamily(familyId: string) {
    if (!familyId) {
      throw new Error('revokeFamily appelé sans familyId');
    }
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  revokeIfActive(id: string) {
    return this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
