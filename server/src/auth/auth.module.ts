import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  providers: [AuthService],
  controllers: [AuthController],
  imports: [AccountsModule],
})
export class AuthModule {}
