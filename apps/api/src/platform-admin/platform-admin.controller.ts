import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import {
  verifyPaymentSchema,
  VerifyPaymentInput,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('admin')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('payments/pending')
  async listPendingPayments() {
    return this.platformAdminService.listPendingPayments();
  }

  @Post('payments/:id/verify')
  async verifyPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(verifyPaymentSchema)) body: VerifyPaymentInput
  ) {
    return this.platformAdminService.verifyPayment(
      id,
      req.user.id,
      body,
      req.id
    );
  }

  @Get('tenants')
  async listTenants() {
    return this.platformAdminService.listTenantsOverview();
  }

  @Get('stats')
  async getPlatformStats() {
    return this.platformAdminService.getPlatformStats();
  }
}
