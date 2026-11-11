import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { Public } from './decorators/public.decorators';
import type { AuthenticatedRequest } from './auth.types';
import { AccountsService } from '../accounts/accounts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsService: AccountsService,
  ) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.accountsService.getProfile(request.user.id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  @Public()
  @Post('guest')
  @HttpCode(204)
  async guest(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const existing: unknown = request.cookies?.guest_token;
    if (typeof existing === 'string') {
      const guestId = await this.authService.verifyGuestToken(existing);
      if (guestId) {
        return;
      }
    }
    const { guestToken, guestTokenExpiresAt } =
      await this.authService.issueGuestToken();
    res.cookie('guest_token', guestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: guestTokenExpiresAt,
    });
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, ...tokens } = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);
    return user;
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const refreshToken: unknown = request.cookies?.refresh_token;
      if (typeof refreshToken !== 'string') {
        throw new UnauthorizedException();
      }
      const { user, ...tokens } = await this.authService.refresh(refreshToken);
      this.setAuthCookies(res, tokens);
      return user;
    } catch (error) {
      this.clearAuthCookies(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken: unknown = request.cookies?.access_token;
    if (typeof accessToken === 'string') {
      await this.authService.logout(accessToken);
    }
    this.clearAuthCookies(res);
  }

  private setAuthCookies(
    res: Response,
    tokens: {
      accessToken: string;
      accessExpiresAt: Date;
      refreshToken: string;
      refreshExpiresAt: Date;
    },
  ) {
    const secure = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      expires: tokens.accessExpiresAt,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      expires: tokens.refreshExpiresAt,
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  }
}
