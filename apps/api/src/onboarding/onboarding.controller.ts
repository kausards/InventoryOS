import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  storeProfileSchema,
  firstWarehouseSchema,
  initialCourierSchema,
  initialProductSchema,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('onboarding')
@UseGuards(AuthGuard, PermissionsGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async getStatus(@Req() req: any) {
    return this.onboardingService.getStatus(req.tenantId);
  }

  @Post('store-profile')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async saveStoreProfile(
    @Req() req: any,
    @Body(new ZodValidationPipe(storeProfileSchema)) body: any
  ) {
    return this.onboardingService.saveStoreProfile(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post('warehouse')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async saveWarehouse(
    @Req() req: any,
    @Body(new ZodValidationPipe(firstWarehouseSchema)) body: any
  ) {
    return this.onboardingService.saveWarehouse(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post('courier')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async saveCourier(
    @Req() req: any,
    @Body(new ZodValidationPipe(initialCourierSchema)) body: any
  ) {
    return this.onboardingService.saveCourier(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post('product')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async saveProduct(
    @Req() req: any,
    @Body(new ZodValidationPipe(initialProductSchema)) body: any
  ) {
    return this.onboardingService.saveInitialProduct(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Post('complete')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async completeOnboarding(@Req() req: any) {
    return this.onboardingService.completeOnboarding(
      req.tenantId,
      req.user.id,
      req.headers['x-request-id']
    );
  }
}
