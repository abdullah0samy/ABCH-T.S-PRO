import { Injectable, Inject, UnauthorizedException, ForbiddenException, BadRequestException, HttpException, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './auth.utils';
import { RefreshTokenStore } from './refresh-token.store';

function verifyDjangoPassword(password: string, djangoHash: string): boolean {
  try {
    const parts = djangoHash.split('$');

    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const expectedHash = parts[3];

    if (!Number.isInteger(iterations) || !salt || !expectedHash) {
      return false;
    }

    const derived = crypto
      .pbkdf2Sync(password, salt, iterations, 32, 'sha256')
      .toString('base64');

    return derived === expectedHash;
  } catch {
    return false;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RefreshTokenStore) private readonly tokens: RefreshTokenStore,
  ) {}

  async login(identifier: string, password: string) {
    if (!identifier || !password) {
      throw new BadRequestException('ID and password are required');
    }

    if (typeof password !== 'string' || password.length > 128) {
      throw new BadRequestException('Invalid password format');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(identifier)) {
      throw new BadRequestException('Invalid identifier format');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { badgeNumber: identifier },
          { username: identifier },
        ],
      },
      include: { department: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({ message: 'Invalid credentials or inactive account' });
    }

    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      throw new HttpException({
        message: 'Account locked. Too many failed attempts.',
        lockUntil: user.lockUntil,
      }, 423);
    }

    if (user.lockUntil && new Date(user.lockUntil) <= new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockUntil: null },
      });
    }

    let isPasswordValid = false;

    if (user.passwordHash.startsWith('pbkdf2_sha256$')) {
      isPasswordValid = verifyDjangoPassword(password, user.passwordHash);

      if (isPasswordValid) {
        const newBcryptHash = await bcrypt.hash(password, 10);

        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newBcryptHash },
        });
      }
    } else {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    }

    if (!isPasswordValid) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockData: any = { failedLoginAttempts: newAttempts };
      if (newAttempts >= 5) {
        lockData.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: lockData,
      });
      throw new UnauthorizedException({ message: 'Invalid credentials' });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, jti } = generateRefreshToken(user);
    await this.tokens.register(user.id, jti);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        badgeNumber: user.badgeNumber,
        username: user.username,
        fullNameAr: user.fullNameAr,
        fullNameEn: user.fullNameEn,
        role: user.role,
        department: user.department,
      },
    };
  }

  /**
   * Exchange a refresh token for a new access token, rotating the refresh
   * token in the process. The caller is responsible for writing the returned
   * `refreshToken` back to the httpOnly cookie.
   */
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException({ message: 'Refresh token required' });
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);

      if (!decoded || !decoded.id || !decoded.jti) {
        throw new ForbiddenException({ message: 'Invalid refresh token payload' });
      }

      // A token whose jti is gone was either logged out or already rotated.
      // The second case means someone is replaying a used token, so drop every
      // session for that user rather than just refusing this one request.
      const active = await this.tokens.isActive(decoded.id, decoded.jti);
      if (!active) {
        const dropped = await this.tokens.revokeAllForUser(decoded.id);
        this.logger.warn(
          `Refresh token replay for user ${decoded.id}; revoked ${dropped} session(s)`,
        );
        throw new ForbiddenException({ message: 'Refresh token is no longer valid' });
      }

      const user = await this.prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user || !user.isActive) {
        await this.tokens.revokeAllForUser(decoded.id);
        throw new UnauthorizedException({ message: 'Invalid refresh token or inactive account' });
      }

      // Rotate: the presented token is spent the moment it is used.
      await this.tokens.revoke(user.id, decoded.jti);
      const { token: newRefreshToken, jti } = generateRefreshToken(user);
      await this.tokens.register(user.id, jti);

      return {
        accessToken: generateAccessToken(user),
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException({ message: 'Invalid or expired refresh token' });
    }
  }

  /**
   * Clearing the cookie only stops a well-behaved browser; the token itself
   * has to be revoked server-side or it stays usable for its full lifetime.
   */
  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        if (decoded?.id && decoded?.jti) {
          await this.tokens.revoke(decoded.id, decoded.jti);
        }
      } catch {
        // An expired or forged token needs no revoking — logout still succeeds.
      }
    }
    return { message: 'Logged out successfully' };
  }

  /** Sign a user out everywhere. Used after a password change. */
  async revokeAllSessions(userId: number) {
    const count = await this.tokens.revokeAllForUser(userId);
    return { revoked: count };
  }
}
