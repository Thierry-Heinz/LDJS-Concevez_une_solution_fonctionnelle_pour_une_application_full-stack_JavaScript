import { AccountsModule } from '../src/accounts/accounts.module';
import { AccountsRepository } from '../src/accounts/accounts.repository';
import { AccountsService } from '../src/accounts/accounts.service';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, type TestApp } from './setup/app';

// Sans strict, get() cherche dans toute l'application et renvoie la première
// instance trouvée, pas forcément celle du module sélectionné.
const STRICT = { strict: true };

describe('Application (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('injection de dépendances', () => {
    it('partage une seule instance de PrismaService', () => {
      const repository = t.app
        .select(AccountsModule)
        .get(AccountsRepository, STRICT);

      expect(repository['prisma']).toBe(
        t.app.select(PrismaModule).get(PrismaService, STRICT),
      );
    });

    it('partage une seule instance d’AccountsService', () => {
      const authService = t.app.select(AuthModule).get(AuthService, STRICT);

      expect(authService['accountsService']).toBe(
        t.app.select(AccountsModule).get(AccountsService, STRICT),
      );
    });
  });
});
