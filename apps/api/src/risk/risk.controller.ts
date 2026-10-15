import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RiskService } from './risk.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  updateRiskRulesSchema,
  createBlacklistEntrySchema,
  manualRiskReviewSchema,
  checkRiskInputSchema,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('risk')
@UseGuards(AuthGuard, PermissionsGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  async getSettings(@Req() req: any) {
    return this.riskService.getSettings(req.tenantId);
  }

  @Put('settings')
  @RequirePermissions(PERMISSIONS.RISK_MANAGE)
  async updateSettings(
    @Req() req: any,
    @Body(new ZodValidationPipe(updateRiskRulesSchema)) body: any
  ) {
    return this.riskService.updateSettings(req.tenantId, req.user?.id, body);
  }

  @Get('rules-history')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  async getRulesHistory(@Req() req: any) {
    return this.riskService.getRulesHistory(req.tenantId);
  }

  @Get('blacklist')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  async listBlacklist(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string
  ) {
    const options: { search?: string; type?: string; isActive?: boolean } = {};
    if (search) options.search = search;
    if (type) options.type = type;
    if (isActive !== undefined) options.isActive = isActive === 'true';

    return this.riskService.listBlacklist(req.tenantId, options);
  }

  @Post('blacklist')
  @RequirePermissions(PERMISSIONS.RISK_MANAGE)
  async addBlacklistEntry(
    @Req() req: any,
    @Body(new ZodValidationPipe(createBlacklistEntrySchema)) body: any
  ) {
    return this.riskService.addBlacklistEntry(req.tenantId, req.user?.id, body);
  }

  @Delete('blacklist/:id')
  @RequirePermissions(PERMISSIONS.RISK_MANAGE)
  async deactivateBlacklistEntry(@Req() req: any, @Param('id') id: string) {
    return this.riskService.deactivateBlacklistEntry(req.tenantId, id);
  }

  @Post('check')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  async checkCustomerRisk(
    @Req() req: any,
    @Body(new ZodValidationPipe(checkRiskInputSchema)) body: any
  ) {
    return this.riskService.checkCustomerRisk(req.tenantId, body);
  }

  @Post('orders/:id/review')
  @RequirePermissions(PERMISSIONS.RISK_OVERRIDE)
  async reviewOrderRisk(
    @Req() req: any,
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(manualRiskReviewSchema)) body: any
  ) {
    return this.riskService.reviewOrderRisk(req.tenantId, req.user?.id, orderId, body);
  }

  @Get('orders/review-queue')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  async getReviewQueue(@Req() req: any) {
    return this.riskService.getReviewQueue(req.tenantId);
  }
}
