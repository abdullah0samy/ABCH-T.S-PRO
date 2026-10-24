import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Server-side control over refresh tokens.
 *
 * A JWT is valid until it expires — signing one and forgetting about it means
 * logout cannot actually log anyone out, and a stolen refresh token stays good
 * for its full seven days. So every refresh token carries a `jti` and is only
 * accepted while that `jti` is present in Redis:
 *
 *   login    -> register(jti)
 *   refresh  -> consume(old jti) + register(new jti)   (rotation)
 *   logout   -> revoke(jti)
 *
 * Rotation also detects theft: if an already-consumed `jti` is presented, the
 * token was replayed, so every session for that user is dropped.
 *
 * Redis being unavailable must not lock everyone out of the product, so the
 * store fails open on read and logs loudly — the JWT signature is still
 * checked in every path that calls in here.
 */
@Injectable()
export class RefreshTokenStore implements OnModuleDestroy {
  private readonly logger = new Logger(RefreshTokenStore.name);
  private readonly redis: Redis;
  private available = true;

  /** Refresh tokens live 7 days; the record must outlive the token. */
  private static readonly TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });

    this.redis.on('error', (error) => {
      if (this.available) {
        this.available = false;
        this.logger.error(`Redis unavailable, refresh tokens cannot be revoked: ${error.message}`);
      }
    });

    this.redis.on('ready', () => {
      if (!this.available) this.logger.log('Redis reconnected, token revocation active again');
      this.available = true;
    });
  }

  private key(userId: number, jti: string) {
    return `refresh:${userId}:${jti}`;
  }

  private userPattern(userId: number) {
    return `refresh:${userId}:*`;
  }

  /** Record a freshly issued refresh token as valid. */
  async register(userId: number, jti: string): Promise<void> {
    try {
      await this.redis.set(this.key(userId, jti), '1', 'EX', RefreshTokenStore.TTL_SECONDS);
    } catch (error) {
      this.logger.error(`Could not register refresh token: ${(error as Error).message}`);
    }
  }

  /** True when this token is still the live one for that user. */
  async isActive(userId: number, jti: string): Promise<boolean> {
    try {
      const found = await this.redis.exists(this.key(userId, jti));
      return found === 1;
    } catch (error) {
      // Fail open: the signature was already verified by the caller, and a
      // Redis outage should not sign every user out of a hospital system.
      this.logger.error(`Could not check refresh token, allowing: ${(error as Error).message}`);
      return true;
    }
  }

  /** Invalidate one token. */
  async revoke(userId: number, jti: string): Promise<void> {
    try {
      await this.redis.del(this.key(userId, jti));
    } catch (error) {
      this.logger.error(`Could not revoke refresh token: ${(error as Error).message}`);
    }
  }

  /** Invalidate every session for a user — used on replay and password change. */
  async revokeAllForUser(userId: number): Promise<number> {
    try {
      const keys = await this.redis.keys(this.userPattern(userId));
      if (keys.length === 0) return 0;
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      this.logger.error(`Could not revoke user sessions: ${(error as Error).message}`);
      return 0;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
