import { Controller, Get, Query, Res, UseGuards, Inject, Req, Header } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import type { Response } from 'express';
import fs from 'fs';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
@Throttle({ analytics: {} })
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard-summary')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async getDashboardSummary(@Req() req: any) {
    return this.analyticsService.getDashboardSummary(req.user.role, req.user.id, req.user.departmentId ?? null);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async getStats(@Req() req: any) {
    return this.analyticsService.getStats(req.user.role, req.user.id, req.user.departmentId ?? null);
  }

  @Get('status-distribution')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async getStatusDistribution(@Req() req: any) {
    return this.analyticsService.getStatusDistribution(req.user.role, req.user.id, req.user.departmentId ?? null);
  }

  @Get('priority-distribution')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async getPriorityDistribution(@Req() req: any) {
    return this.analyticsService.getPriorityDistribution(req.user.role, req.user.id, req.user.departmentId ?? null);
  }

  @Get('department-performance')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor')
  async getDepartmentPerformance(@Req() req: any) {
    return this.analyticsService.getDepartmentPerformance(req.user.role, req.user.departmentId ?? null);
  }

  @Get('recent-activity')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  async getRecentActivity() {
    return this.analyticsService.getRecentActivity();
  }

  @Get('agent-performance')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor')
  async getAgentPerformance(@Req() req: any) {
    return this.analyticsService.getAgentPerformance(req.user.role, req.user.departmentId ?? null);
  }

  @Get('aht')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async getAHT(@Req() req: any) {
    return this.analyticsService.getAHT(req.user.role, req.user.id, req.user.departmentId ?? null);
  }

  @Get('exports')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async getExports(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.analyticsService.getExports(req.user.role, req.user.id, page, limit);
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'supervisor', 'agent')
  async exportExcel(@Res() res: Response, @Req() req: any, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const { filePath, fileName } = await this.analyticsService.exportExcel(req.user.id, req.user.role, req.user.departmentId ?? null, startDate, endDate);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('end', () => { if (!res.headersSent) res.end(); });
  }
}
