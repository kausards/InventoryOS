import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@growthomic/shared';
import {
  generateDocumentSignedUrlSchema,
  createPrintLogSchema,
} from '@growthomic/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Generates a signed, expiring URL token for document access.
   */
  @Post('signed-url')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DOCUMENTS_VIEW)
  async generateSignedUrl(
    @Req() req: any,
    @Body(new ZodValidationPipe(generateDocumentSignedUrlSchema)) body: any
  ) {
    return this.documentsService.generateSignedUrl(req.tenantId, req.user?.id, body);
  }

  /**
   * Secure rendering endpoint for invoices, packing slips, barcode labels.
   * Accessible either with a valid cryptographic signed token OR an authenticated session.
   */
  @Get('render')
  async renderDocument(
    @Req() req: any,
    @Query('token') token?: string,
    @Query('expires') expires?: string,
    @Query('tenantId') tenantId?: string,
    @Query('documentType') documentType?: string,
    @Query('referenceId') referenceId?: string,
    @Query('format') format?: string,
    @Query('lang') lang?: string
  ) {
    // 1. If signed token provided, verify cryptographic signature and expiration
    if (token && expires && tenantId && documentType && referenceId) {
      this.documentsService.verifySignedToken({
        token,
        expires: Number(expires),
        tenantId,
        documentType,
        referenceId,
        format: format || 'a4',
      });

      return this.documentsService.renderDocumentData(
        tenantId,
        documentType,
        referenceId,
        format || 'a4',
        (lang as any) || 'en'
      );
    }

    // 2. Otherwise require tenant context header from authenticated user
    const sessionTenantId = req.headers['x-tenant-id'] || tenantId;
    if (!sessionTenantId || !documentType || !referenceId) {
      throw new ForbiddenException('Missing authorization token or signed parameters');
    }

    return this.documentsService.renderDocumentData(
      sessionTenantId,
      documentType,
      referenceId,
      format || 'a4',
      (lang as any) || 'en'
    );
  }

  /**
   * Logs a print action to the immutable audit print_logs table.
   */
  @Post('print-log')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DOCUMENTS_PRINT)
  async createPrintLog(
    @Req() req: any,
    @Body(new ZodValidationPipe(createPrintLogSchema)) body: any
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    return this.documentsService.createPrintLog(
      req.tenantId,
      req.user?.id,
      req.user?.name,
      {
        ...body,
        ipAddress: ip ? String(ip) : undefined,
      }
    );
  }

  /**
   * Retrieves print logs history.
   */
  @Get('print-logs')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.DOCUMENTS_VIEW)
  async listPrintLogs(@Req() req: any, @Query('limit') limit?: string) {
    return this.documentsService.listPrintLogs(req.tenantId, limit ? Number(limit) : 50);
  }
}
