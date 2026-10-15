import type { Job } from 'pg-boss';
import { withSystem, warehouseStockBalances, inventoryMovements, auditLogs } from '@growthomic/db';
import { eq, and, sql } from 'drizzle-orm';

export interface InventoryDriftCheckPayload {
  tenantId: string;
  warehouseId?: string;
}

export interface DriftReportItem {
  warehouseId: string;
  variantId: string;
  onHand: number;
  ledgerSum: number;
  drift: number;
}

export async function handleInventoryDriftCheck(
  job: Job<InventoryDriftCheckPayload>
): Promise<{ success: boolean; scanned: number; drifted: number; reports: DriftReportItem[] }> {
  const { tenantId, warehouseId } = job.data;

  if (!tenantId) {
    throw new Error(`[Security] Job ${job.id} rejected: Missing tenantId in payload.`);
  }

  return withSystem(async (tx) => {
    // 1. Fetch stock balances to verify
    const balances = await tx
      .select({
        id: warehouseStockBalances.id,
        warehouseId: warehouseStockBalances.warehouseId,
        variantId: warehouseStockBalances.variantId,
        onHand: warehouseStockBalances.onHand,
      })
      .from(warehouseStockBalances)
      .where(
        warehouseId
          ? and(
              eq(warehouseStockBalances.tenantId, tenantId),
              eq(warehouseStockBalances.warehouseId, warehouseId)
            )
          : eq(warehouseStockBalances.tenantId, tenantId)
      );

    const reports: DriftReportItem[] = [];

    for (const b of balances) {
      // 2. Sum inventory ledger movements for this warehouse + variant
      const sumResult = await tx
        .select({
          total: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0)::int`,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.tenantId, tenantId),
            eq(inventoryMovements.warehouseId, b.warehouseId),
            eq(inventoryMovements.variantId, b.variantId)
          )
        );

      const ledgerSum = Number(sumResult[0]?.total ?? 0);
      const drift = b.onHand - ledgerSum;

      if (drift !== 0) {
        reports.push({
          warehouseId: b.warehouseId,
          variantId: b.variantId,
          onHand: b.onHand,
          ledgerSum,
          drift,
        });

        // Record audit anomaly
        await tx.insert(auditLogs).values({
          tenantId,
          actorType: 'worker',
          action: 'inventory.drift_detected',
          entityType: 'warehouse_stock_balance',
          entityId: b.id,
          after: {
            warehouseId: b.warehouseId,
            variantId: b.variantId,
            cachedOnHand: b.onHand,
            ledgerSum,
            drift,
            jobId: job.id,
          },
        });
      }
    }

    return {
      success: true,
      scanned: balances.length,
      drifted: reports.length,
      reports,
    };
  });
}
