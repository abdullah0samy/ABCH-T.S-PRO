import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Inject, HttpCode, Query, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssetsService } from './assets.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('api/assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assetsService: AssetsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor')
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assetsService.findAll(req.user.role, req.user.departmentId ?? null, { page: Number(page) || 1, limit: Math.min(Number(limit) || 50, 100) });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor')
  @HttpCode(201)
  async create(@Req() req: any, @CurrentUser('id') userId: number, @Body() body: any) {
    return this.assetsService.create(userId, req.user.role, req.user.departmentId ?? null, body);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor')
  async update(@Req() req: any, @CurrentUser('id') userId: number, @Param('id') id: string, @Body() body: any) {
    return this.assetsService.update(userId, req.user.role, req.user.departmentId ?? null, parseInt(id), body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @HttpCode(204)
  async remove(@Req() req: any, @CurrentUser('id') userId: number, @Param('id') id: string) {
    await this.assetsService.remove(userId, req.user.role, req.user.departmentId ?? null, parseInt(id));
  }
}
