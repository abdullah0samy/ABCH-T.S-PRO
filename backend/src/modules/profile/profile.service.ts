import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenStore } from '../auth/refresh-token.store';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RefreshTokenStore) private readonly tokens: RefreshTokenStore,
  ) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, badgeNumber: true, username: true, fullNameAr: true, fullNameEn: true,
        email: true, role: true, avatarUrl: true, about: true, isActive: true, departmentId: true,
        department: { select: { nameAr: true, nameEn: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: number, body: { avatarUrl?: string; about?: string }) {
    const data: any = {};
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
    if (body.about !== undefined) data.about = body.about;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, badgeNumber: true, username: true, fullNameAr: true, fullNameEn: true,
        email: true, role: true, avatarUrl: true, about: true, isActive: true, departmentId: true,
        department: { select: { nameAr: true, nameEn: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        newData: { avatarUrl: body.avatarUrl, about: body.about },
        entityType: 'USER_PROFILE',
        entityId: user.id,
      },
    });

    return user;
  }

  /**
   * Change your own password.
   *
   * Until now only an admin could reset a password, which meant a user who
   * suspected their credentials were exposed had to wait for someone else —
   * and `forcePasswordChange` was set on accounts with no way to satisfy it.
   *
   * Every other session is dropped afterwards: if the reason for changing is
   * that someone else knows the old password, leaving their refresh token
   * alive defeats the point.
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGE_FAILED',
          entityType: 'USER',
          entityId: userId,
        },
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, forcePasswordChange: false },
    });

    const revoked = await this.tokens.revokeAllForUser(userId);

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
        entityType: 'USER',
        entityId: userId,
        newData: { sessionsRevoked: revoked },
      },
    });

    return { message: 'Password changed. Please sign in again.', sessionsRevoked: revoked };
  }
}
