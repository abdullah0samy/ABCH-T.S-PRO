import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenStore } from './refresh-token.store';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenStore],
  exports: [AuthService, RefreshTokenStore],
})
export class AuthModule {}
