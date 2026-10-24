import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  console.error('🔴 CRITICAL: JWT secrets must be configured via environment variables!');
  process.exit(1);
}

export interface RefreshPayload {
  id: number;
  jti: string;
  iat?: number;
  exp?: number;
}

export const generateAccessToken = (user: any) => {
  return jwt.sign(
    { id: user.id, role: user.role, departmentId: user.departmentId },
    ACCESS_SECRET,
    { expiresIn: '8h' }
  );
};

/**
 * Refresh tokens carry a unique `jti` so the server can revoke a specific
 * token: without it a refresh token is valid for its whole lifetime no matter
 * what logout does. The caller must register the returned `jti` in
 * `RefreshTokenStore`, or the token will be rejected on first use.
 */
export const generateRefreshToken = (user: any): { token: string; jti: string } => {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { id: user.id, jti },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { token, jti };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
};
