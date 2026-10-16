import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ImportsService } from './imports.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  dryRunImportSchema,
  commitImportSchema,
  undoBatchSchema,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('imports')
@UseGuards(AuthGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('dry-run')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async dryRun(
    @Req() req: any,
    @Body(new ZodValidationPipe(dryRunImportSchema)) body: any
  ) {
    return this.importsService.dryRun(req.tenantId, body);
  }

  @Post('commit')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async commit(
    @Req() req: any,
    @Body(new ZodValidationPipe(commitImportSchema)) body: any
  ) {
    return this.importsService.commit(
      req.tenantId,
      req.user.id,
      body,
      req.headers['x-request-id']
    );
  }

  @Get('batches')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async listBatches(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.importsService.listBatches(
      req.tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );
  }

  @Post('batches/:id/undo')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async undoBatch(
    @Req() req: any,
    @Param('id') id: string
  ) {
    return this.importsService.undoBatch(
      req.tenantId,
      req.user.id,
      id,
      req.headers['x-request-id']
    );
  }
}
