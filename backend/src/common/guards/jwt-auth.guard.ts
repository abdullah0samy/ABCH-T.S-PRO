import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common';
import { verifyAccessToken } from '../../modules/auth/auth.utils';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException({ error: 'Unauthorized', code: 'MISSING_TOKEN' });
    }

    try {
      const decoded = verifyAccessToken(token);
      if (!decoded || typeof decoded === 'string' || !decoded.id) {
        throw new ForbiddenException({ message: 'Invalid token payload', code: 'FORBIDDEN' });
      }
      
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id as number },
        select: { isActive: true, deletedAt: true },
      });
      if (!user || !user.isActive || user.deletedAt) {
        throw new ForbiddenException({ message: 'Account deactivated or deleted', code: 'ACCOUNT_INACTIVE' });
      }
      request.user = decoded;
      return true;
    } catch (error) {
      throw new ForbiddenException({ message: 'Forbidden or expired token', code: 'FORBIDDEN' });
    }
  }
}
