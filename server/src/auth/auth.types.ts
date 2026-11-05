export type CreateRefreshTokenData = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  sessionExpiresAt: Date;
};
