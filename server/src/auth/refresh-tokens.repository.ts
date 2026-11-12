import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  /**
   * Révoque tous les jetons encore actifs d'une session (famille).
   */
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

  /**
   * Révoque un jeton seulement s'il est encore actif, en une seule requête.
   *
   * @returns `count: 0` si le jeton avait déjà été révoqué : c'est ce qui détecte
   * une réutilisation, même si deux requêtes arrivent en même temps.
   */
  revokeIfActive(id: string) {
    return this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
