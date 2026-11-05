import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountsModule } from 'src/accounts/accounts.module';
import { JwtModule } from '@nestjs/jwt';
import { RefreshTokensRepository } from './refresh-tokens.repository';

@Module({
  imports: [AccountsModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokensRepository],
})
export class AuthModule {}
