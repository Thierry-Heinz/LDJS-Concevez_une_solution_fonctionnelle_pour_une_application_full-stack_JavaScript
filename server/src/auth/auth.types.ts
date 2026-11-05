import { Request } from 'express';
import { Role } from 'src/generated/prisma/enums';

export type AuthenticatedRequest = Request & {
  user: { id: string; role: Role };
};

export type CreateRefreshTokenData = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  sessionExpiresAt: Date;
};

export type RefreshTokenData = CreateRefreshTokenData & {
  revokedAt: Date;
};

export type AccessTokenPayload = {
  sub: string; // l'id de l'utilisateur
  role: Role;
  iat: number; // date d'émission, ajoutée automatiquement (en secondes)
  exp: number; // date d'expiration, ajoutée automatiquement
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
};
