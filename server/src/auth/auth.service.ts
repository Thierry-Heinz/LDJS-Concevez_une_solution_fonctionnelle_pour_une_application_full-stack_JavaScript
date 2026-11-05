import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from 'src/generated/prisma/enums';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;
  private readonly accessSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshSecret: string;
  private readonly refreshIdleTtlSeconds: number;
  private readonly sessionAbsoluteTtlSeconds: number;

  constructor(
    private readonly accountsService: AccountsService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtlSeconds = Number(
      config.getOrThrow<string>('ACCESS_TOKEN_TTL_SECONDS'),
    );
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshIdleTtlSeconds = Number(
      config.getOrThrow<string>('REFRESH_TOKEN_IDLE_TTL_SECONDS'),
    );
    this.sessionAbsoluteTtlSeconds = Number(
      config.getOrThrow<string>('SESSION_ABSOLUTE_TTL_SECONDS'),
    );
    console.log({
      accessTtl: this.accessTtlSeconds,
      refreshIdleTtl: this.refreshIdleTtlSeconds,
      sessionTtl: this.sessionAbsoluteTtlSeconds,
    });
  }

  async onModuleInit() {
    this.dummyHash = await argon2.hash('dummy-password-for-timing');
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password);
    return this.accountsService.createCustomer({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      birthDate: dto.birthDate,
      address: dto.address,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.validateCredentials(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const familyId = crypto.randomUUID();
    const sessionExpiresAt = new Date(
      Date.now() + this.sessionAbsoluteTtlSeconds * 1000,
    );
    const tokens = await this.issueTokens(user, { familyId, sessionExpiresAt });
    return { user, ...tokens };
  }

  private async validateCredentials(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.accountsService.findByEmail(normalizedEmail);
    if (!user) {
      await argon2.verify(this.dummyHash, password);
      return null;
    }
    const passwordHash = await this.accountsService.getPasswordHash(user.id);
    if (!passwordHash) {
      return null;
    }
    const valid = await argon2.verify(passwordHash, password);
    if (!valid) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private async issueTokens(
    user: { id: string; role: Role },
    session: { familyId: string; sessionExpiresAt: Date },
  ) {
    const now = Date.now();

    const accessExpiresAt = new Date(now + this.accessTtlSeconds * 1000);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      },
    );

    const jti = crypto.randomUUID();

    const refreshExpiresAt = new Date(
      Math.min(
        now + this.refreshIdleTtlSeconds * 1000,
        session.sessionExpiresAt.getTime(),
      ),
    );

    const refreshTtlSeconds = Math.floor(
      (refreshExpiresAt.getTime() - now) / 1000,
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
      },
      {
        secret: this.refreshSecret,
        expiresIn: refreshTtlSeconds,
        jwtid: jti,
      },
    );

    const tokenHash = await argon2.hash(refreshToken);

    await this.refreshTokensRepository.create({
      id: jti,
      userId: user.id,
      familyId: session.familyId,
      tokenHash,
      expiresAt: refreshExpiresAt,
      sessionExpiresAt: session.sessionExpiresAt,
    });

    return { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt };
  }
}
