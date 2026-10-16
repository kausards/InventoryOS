import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import {
  PERMISSIONS,
  manualPaymentSubmissionSchema,
  ManualPaymentSubmissionInput,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('current')
  @UseGuards(AuthGuard)
  async getCurrentSubscription(@Req() req: any) {
    return this.subscriptionsService.getCurrentSubscription(req.tenantId);
  }

  @Post('manual-payment')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_BILLING)
  async submitManualPayment(
    @Req() req: any,
    @Body(new ZodValidationPipe(manualPaymentSubmissionSchema)) body: ManualPaymentSubmissionInput
  ) {
    return this.subscriptionsService.submitManualPayment(
      req.tenantId,
      req.user.id,
      body,
      req.id
    );
  }

  @Get('manual-payments')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_BILLING)
  async listManualPayments(@Req() req: any) {
    return this.subscriptionsService.listManualPayments(req.tenantId);
  }

  @Get('invoices')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_BILLING)
  async listInvoices(@Req() req: any) {
    return this.subscriptionsService.listInvoices(req.tenantId);
  }
}
