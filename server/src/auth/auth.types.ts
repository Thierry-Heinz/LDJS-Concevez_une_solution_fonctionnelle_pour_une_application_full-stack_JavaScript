import { Request } from 'express';
import { Role } from '../generated/prisma/enums';

export type AuthUser = {
  id: string;
  role: Role;
  sid: string;
  agencyId: string | null;
};

export type AuthenticatedRequest = Request & { user: AuthUser };
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

type JwtBasePayload = { sub: string; iat: number; exp: number };

export type AccessTokenPayload = JwtBasePayload & {
  role: Role;
  sid: string;
  agencyId: string | null;
};

export type RefreshTokenPayload = JwtBasePayload & { jti: string };
