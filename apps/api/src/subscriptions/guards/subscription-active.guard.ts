import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // 1. Safe HTTP methods (GET, HEAD, OPTIONS) are ALWAYS permitted in Restricted Read-Only Mode (PRD Part X)
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    // 2. Billing & Payment routes are allowed so users can renew/pay
    const url = request.url || '';
    if (
      url.includes('/subscriptions/manual-payment') ||
      url.includes('/auth/') ||
      url.includes('/admin/')
    ) {
      return true;
    }

    const tenantId = request.tenantId;
    if (!tenantId) {
      return true; // Non-tenant requests are handled by other guards
    }

    // 3. Fetch current tenant subscription status
    const current = await this.subscriptionsService.getCurrentSubscription(tenantId);
    if (!current) {
      return true;
    }

    // 4. Enforce Restricted Read-Only Mode
    if (current.statusChecks.isRestrictedReadOnlyMode) {
      throw new ForbiddenException(
        'Your subscription is currently inactive or expired. The account is in Restricted Read-Only Mode. Please renew your plan under Settings > Billing.'
      );
    }

    // 5. Enforce Order Limit (+10% grace overage allowed) on new order creation
    if (method === 'POST' && url.includes('/orders') && !url.includes('/orders/import')) {
      if (!current.statusChecks.orderLimit.isAllowed) {
        throw new ForbiddenException(
          `Monthly order limit exceeded (${current.statusChecks.orderLimit.current}/${current.statusChecks.orderLimit.allowed} allowed + 10% grace limit ${current.statusChecks.orderLimit.effectiveLimit}). Please upgrade your plan under Settings > Billing.`
        );
      }
    }

    return true;
  }
}
