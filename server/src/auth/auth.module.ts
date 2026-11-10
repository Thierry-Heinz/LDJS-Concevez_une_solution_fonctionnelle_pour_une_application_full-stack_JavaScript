import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountsModule } from 'src/accounts/accounts.module';
import { JwtModule } from '@nestjs/jwt';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountsService } from 'src/accounts/accounts.service';
import { AccountsRepository } from 'src/accounts/accounts.repository';

@Module({
  imports: [AccountsModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    AuthService,
    AccountsService,
    AccountsRepository,
    RefreshTokensRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
