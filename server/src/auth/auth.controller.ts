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
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { Public } from './decorators/public.decorators';
import type { AuthenticatedRequest } from './auth.types';
import { AccountsService } from '../accounts/accounts.service';
import { UserProfileDto } from './dto/user-profile.dto';
import { RefreshedUserDto, SessionUserDto } from './dto/session-user.dto';
import { ApiErrorDto } from '../common/dto/api-error.dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsService: AccountsService,
  ) {}

  @Get('me')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: "Récupérer le profil de l'utilisateur connecté",
    description:
      "Renvoie le profil de l'utilisateur identifié par le cookie access_token.",
  })
  @ApiOkResponse({
    description: "Profil de l'utilisateur connecté",
    type: UserProfileDto.Output,
  })
  @ApiUnauthorizedResponse({
    description: "Jeton d'accès absent, invalide ou expiré, ou compte supprimé",
    type: ApiErrorDto.Output,
  })
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
  @ApiOperation({
    summary: 'Ouvrir une session invité',
    description:
      "Dépose un cookie httpOnly guest_token permettant d'utiliser le chat sans compte. Si un jeton invité valide est déjà présent, il est conservé.",
  })
  @ApiNoContentResponse({
    description: 'Session invité ouverte ou déjà active (cookie guest_token)',
  })
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
  @ApiOperation({
    summary: 'Créer un compte client',
    description:
      "Inscrit un nouveau client. L'adresse e-mail est normalisée (espaces retirés, minuscules) et le mot de passe est haché avant enregistrement.",
  })
  @ApiBody({ type: RegisterDto, description: 'Informations du nouveau client' })
  @ApiCreatedResponse({ description: 'Compte client créé' })
  @ApiBadRequestResponse({
    description: "Données d'inscription invalides",
    type: ApiErrorDto.Output,
  })
  @ApiConflictResponse({
    description: 'Adresse e-mail déjà utilisée : code EMAIL_ALREADY_USED',
    type: ApiErrorDto.Output,
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Se connecter',
    description:
      'Vérifie les identifiants et ouvre une session : dépose les cookies httpOnly access_token et refresh_token.',
  })
  @ApiBody({ type: LoginDto, description: 'Identifiants de connexion' })
  @ApiOkResponse({
    description: 'Connexion réussie, utilisateur connecté',
    type: SessionUserDto.Output,
  })
  @ApiBadRequestResponse({
    description: 'Données de connexion invalides',
    type: ApiErrorDto.Output,
  })
  @ApiUnauthorizedResponse({
    description: 'Identifiants incorrects',
    type: ApiErrorDto.Output,
  })
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
  @ApiCookieAuth('refresh_token')
  @ApiOperation({
    summary: 'Rafraîchir la session',
    description:
      "Échange le cookie refresh_token contre une nouvelle paire de jetons (rotation). La session conserve sa limite de durée absolue. En cas d'échec, les cookies d'authentification sont supprimés.",
  })
  @ApiOkResponse({
    description: 'Session rafraîchie, nouveaux cookies déposés',
    type: RefreshedUserDto.Output,
  })
  @ApiUnauthorizedResponse({
    description:
      'Jeton de rafraîchissement absent, invalide, révoqué ou session expirée',
    type: ApiErrorDto.Output,
  })
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
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Se déconnecter',
    description:
      "Révoque la session associée au cookie access_token (même expiré) et supprime les cookies d'authentification.",
  })
  @ApiNoContentResponse({ description: 'Déconnexion effectuée' })
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
