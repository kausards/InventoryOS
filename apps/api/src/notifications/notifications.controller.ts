import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreditsLedgerService } from './credits-ledger.service';
import { ConsentService } from './consent.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import {
  PERMISSIONS,
  sendNotificationSchema,
  topUpCreditsSchema,
  updateConsentSchema,
  createTemplateSchema,
  updateTemplateSchema,
  updatePreferencesSchema,
  SendNotificationInput,
  TopUpCreditsInput,
  UpdateConsentInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  UpdatePreferencesInput,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('notifications')
@UseGuards(AuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly creditsLedgerService: CreditsLedgerService,
    private readonly consentService: ConsentService
  ) {}

  @Post('send')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_SEND)
  async sendNotification(
    @Req() req: any,
    @Body(new ZodValidationPipe(sendNotificationSchema)) input: SendNotificationInput
  ) {
    return this.notificationsService.sendNotification(req.tenantId, input);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async listNotifications(
    @Req() req: any,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.notificationsService.listNotifications(req.tenantId, {
      channel,
      status,
      orderId,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':id/retry')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_SEND)
  async retryNotification(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.retryNotification(req.tenantId, id);
  }

  // ----------------------------------------------------
  // In-App Notification Center
  // ----------------------------------------------------

  @Get('in-app')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async getInAppNotifications(@Req() req: any, @Query('limit') limit?: number) {
    return this.notificationsService.getInAppNotifications(
      req.tenantId,
      limit ? Number(limit) : undefined
    );
  }

  @Patch('in-app/:id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async markInAppRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markInAppRead(req.tenantId, id);
  }

  @Post('in-app/read-all')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async markAllInAppRead(@Req() req: any) {
    return this.notificationsService.markAllInAppRead(req.tenantId);
  }

  // ----------------------------------------------------
  // Message Credits Ledger
  // ----------------------------------------------------

  @Get('credits')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async getCredits(@Req() req: any, @Query('channel') channel?: string) {
    const [summary, ledger] = await Promise.all([
      this.creditsLedgerService.getBalanceSummary(req.tenantId),
      this.creditsLedgerService.listLedger(req.tenantId, channel),
    ]);
    return { summary, ledger };
  }

  @Post('credits/topup')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE)
  async topUpCredits(
    @Req() req: any,
    @Body(new ZodValidationPipe(topUpCreditsSchema)) input: TopUpCreditsInput
  ) {
    return this.creditsLedgerService.topUpCredits(
      req.tenantId,
      input.channel,
      input.amount,
      input.description,
      input.referenceId || undefined,
      req.userId
    );
  }

  // ----------------------------------------------------
  // Templates Management
  // ----------------------------------------------------

  @Get('templates')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async listTemplates(@Req() req: any) {
    return this.notificationsService.listTemplates(req.tenantId);
  }

  @Post('templates')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE)
  async createTemplate(
    @Req() req: any,
    @Body(new ZodValidationPipe(createTemplateSchema)) input: CreateTemplateInput
  ) {
    return this.notificationsService.createTemplate(req.tenantId, input);
  }

  @Put('templates/:id')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE)
  async updateTemplate(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) input: UpdateTemplateInput
  ) {
    return this.notificationsService.updateTemplate(req.tenantId, id, input);
  }

  // ----------------------------------------------------
  // Customer Consent (Opt-in / Opt-out)
  // ----------------------------------------------------

  @Get('consents')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async listConsents(@Req() req: any) {
    return this.consentService.listConsents(req.tenantId);
  }

  @Post('consents')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE)
  async updateConsent(
    @Req() req: any,
    @Body(new ZodValidationPipe(updateConsentSchema)) input: UpdateConsentInput
  ) {
    return this.consentService.recordConsent(req.tenantId, input, 'admin_console');
  }

  // ----------------------------------------------------
  // Preferences Management
  // ----------------------------------------------------

  @Get('preferences')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_VIEW)
  async getPreferences(@Req() req: any) {
    return this.notificationsService.getPreferences(req.tenantId);
  }

  @Put('preferences')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_MANAGE)
  async updatePreferences(
    @Req() req: any,
    @Body(new ZodValidationPipe(updatePreferencesSchema)) input: UpdatePreferencesInput
  ) {
    return this.notificationsService.updatePreferences(req.tenantId, input);
  }
}
