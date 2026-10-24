import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

/**
 * AdminRolesController — DEPRECATED / REMOVED
 *
 * The Role/Permission relational model was removed during the P2 clean-up
 * (engineering review P2-8). The flat `user.role` string field (UserRole enum)
 * is the only role mechanism in use.
 *
 * These endpoints are preserved as 410 Gone stubs so any client code that
 * still calls them gets an explicit, informative error instead of a 404 or
 * an unhandled exception.
 *
 * TODO: Remove this controller and its routes in the next major release once
 * all clients have been updated.
 */
@ApiTags('Admin - Roles (Deprecated)')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminRolesController {

  private gone() {
    return {
      statusCode: 410,
      error: 'Gone',
      message:
        'The Role/Permission relational model has been removed. Use the UserRole enum (user.role) instead.',
    };
  }

  @Get('roles')
  @HttpCode(HttpStatus.OK)
  findAllRoles() { return this.gone(); }

  @Post('roles')
  @HttpCode(HttpStatus.OK)
  createRole(@Body() _body: any) { return this.gone(); }

  @Put('roles/:id')
  @HttpCode(HttpStatus.OK)
  updateRole(@Param('id') _id: string, @Body() _body: any) { return this.gone(); }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  removeRole(@Param('id') _id: string) { return this.gone(); }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  findAllPermissions() { return this.gone(); }
}
