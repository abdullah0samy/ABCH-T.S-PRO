import { Controller, Post, Body, Req, Res, HttpCode, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { loginSchema, type LoginInput } from '../../common/schemas/auth.schema';
import { AuthService } from './auth.service';

/** One definition so login, refresh and logout cannot drift apart. */
const REFRESH_COOKIE = 'refreshToken';
const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ login: {} })
  @ApiOperation({ summary: 'Authenticate user with identifier and password' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.identifier, body.password);

    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...refreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // The refresh token is deliberately absent from the body: anything the
    // page can read, injected script can read too.
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ auth: {} })
  @ApiOperation({ summary: 'Rotate the refresh cookie and issue a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Cookie only. Accepting the token from the body would let a script that
    // captured one use it, which is exactly what httpOnly is meant to prevent.
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = await this.authService.refresh(token);

    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...refreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @Throttle({ auth: {} })
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    return this.authService.logout(token);
  }
}
