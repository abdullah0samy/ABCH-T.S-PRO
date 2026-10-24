import { Controller, Get, Put, Post, Body, HttpCode, Res, UseGuards, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { changePasswordSchema, type ChangePasswordInput } from '../../common/schemas/auth.schema';
import { ProfileService } from './profile.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('api/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@CurrentUser('id') userId: number) {
    return this.profileService.getProfile(userId);
  }

  @Put()
  async updateProfile(@CurrentUser('id') userId: number, @Body() body: { avatarUrl?: string; about?: string }) {
    return this.profileService.updateProfile(userId, body);
  }

  @Post('password')
  @HttpCode(200)
  @Throttle({ auth: {} })
  @ApiOperation({ summary: 'Change your own password; signs out every session' })
  async changePassword(
    @CurrentUser('id') userId: number,
    // The pipe belongs on the parameter, not the method: `@UsePipes` applies
    // to every argument, and would run this schema against `userId` too.
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.profileService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );

    // Every refresh token was just revoked, so the cookie in this browser is
    // dead too — clear it rather than leave the client holding a stale one.
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return result;
  }
}
