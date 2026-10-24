import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Inject, BadRequestException, ConflictException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { invalidatePermissionCache } from '../../../core/permissionCache';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
} from '../../../common/schemas/users.schema';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('api/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminUsersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('page') pageStr?: string, @Query('limit') limitStr?: string) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        include: { department: true, permissionsOverride: true },
        orderBy: { fullNameEn: 'asc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  @Post()
  async create(
    // Shape, required fields and the password policy are all enforced by the
    // schema now — including the policy, which this endpoint never applied.
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser('id') userId: number,
  ) {
    const { badgeNumber, username, password, fullNameAr, fullNameEn, email, role, departmentId, isActive, permissionsOverride } = body;

    const existingBadge = await this.prisma.user.findUnique({ where: { badgeNumber } });
    if (existingBadge) {
      throw new ConflictException({ message: 'Badge Number already exists' });
    }
    const existingUsername = await this.prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      throw new ConflictException({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        badgeNumber,
        username,
        passwordHash,
        fullNameAr,
        fullNameEn,
        email,
        role,
        departmentId: departmentId ?? undefined,
        isActive: isActive ?? true,
        ...(permissionsOverride && Object.keys(permissionsOverride).length > 0
          ? { permissionsOverride: { create: permissionsOverride } }
          : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: user.id,
        newData: { badgeNumber, username, role, departmentId }
      }
    });

    const { passwordHash: _, ...safeUser } = user;

    // Immediately evict this user from the permission cache so the new
    // override is applied on their very next request, not after 30s TTL.
    if (permissionsOverride && user.departmentId) {
      invalidatePermissionCache(user.id, user.departmentId);
    }

    return safeUser;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    const { badgeNumber, username, email, fullNameAr, fullNameEn, role, departmentId, isActive, forcePasswordChange, permissionsOverride } = body;

    const oldUser = await this.prisma.user.findUnique({ where: { id: parseInt(id) } });

    const user = await this.prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...(badgeNumber !== undefined && { badgeNumber }),
        ...(username !== undefined && { username }),
        ...(email !== undefined && { email }),
        ...(fullNameAr !== undefined && { fullNameAr }),
        ...(fullNameEn !== undefined && { fullNameEn }),
        ...(role !== undefined && { role }),
        ...(departmentId !== undefined && { departmentId: departmentId ?? null }),
        ...(isActive !== undefined && { isActive }),
        ...(forcePasswordChange !== undefined && { forcePasswordChange }),
        ...(permissionsOverride !== undefined
          ? { permissionsOverride: { upsert: { create: permissionsOverride, update: permissionsOverride } } }
          : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_UPDATED',
        entityType: 'USER',
        entityId: user.id,
        oldData: oldUser ? { role: oldUser.role, isActive: oldUser.isActive } : undefined,
        newData: { role, isActive, departmentId }
      }
    });

    const { passwordHash: _, ...safeUser } = user;

    // Immediately evict the permission cache so any role, department, or
    // permission-override change takes effect on the user's next request
    // rather than waiting for the 30-second TTL. We clear the whole cache
    // because the user's departmentId may itself have changed in this update,
    // making a targeted userId:deptId key unreliable.
    if (permissionsOverride !== undefined || departmentId !== undefined || role !== undefined) {
      invalidatePermissionCache(); // no args → cache.clear()
    }

    return safeUser;
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    const passwordHash = await bcrypt.hash(body.password, 12);

    await this.prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        passwordHash,
        forcePasswordChange: body.forcePasswordChange ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_RESET',
        entityType: 'USER',
        entityId: parseInt(id),
        newData: { forcePasswordChange: body.forcePasswordChange ?? true }
      }
    });

    return { message: 'Password reset successfully' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('id') userId: number) {
    const user = await this.prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_DEACTIVATED',
        entityType: 'USER',
        entityId: user.id
      }
    });

    return { message: 'User deactivated' };
  }
}
