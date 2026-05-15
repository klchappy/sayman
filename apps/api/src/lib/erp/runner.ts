/**
 * ERP sync runner — adapter çağrılarını orkestre eder, DB'ye yazar, log tutar.
 *
 *   runFullSync(connectionId, trigger)
 *     → adapter.syncCariAccounts → cari_accounts upsert
 *     → her cari için adapter.syncCariMovements → cari_movements upsert
 *     → adapter.syncInvoices (varsa) → payable_items upsert (ERP → Sayman)
 *     → erp_sync_logs'a row eklenir
 *
 * Per-connection lock yok şu an — pratikte cron 1 saat aralıkla çalışıyor,
 * iki paralel sync deadlock olmaz çünkü ON CONFLICT idempotent.
 */
import { and, eq, isNotNull, max, sql } from 'drizzle-orm';
import {
  cariAccounts,
  cariMovements,
  erpConnections,
  erpSyncLogs,
  getDb,
  payableItems,
  salesInvoices,
  stockItems,
} from '@sayman/db';
import { logger } from '../../config/logger';
import { decryptSecret } from '../secret-box';
import { getAdapter } from './index';
import type { AdapterConfig } from './types';

export interface SyncResult {
  connection_id: string;
  status: 'success' | 'partial' | 'error';
  cari_pulled: number;
  movements_pulled: number;
  invoices_pulled: number;
  sales_pulled: number;
  stock_pulled: number;
  errors: string[];
  duration_ms: number;
}

// Connection UUID'sini stabil int32'ye çevir (advisory lock için)
function connectionLockId(connectionId: string): number {
  let hash = 0;
  for (let i = 0; i < connectionId.length; i++) {
    hash = ((hash << 5) - hash + connectionId.charCodeAt(i)) | 0;
  }
  return hash;
}

export async function runFullSync(
  connectionId: string,
  trigger: 'manual' | 'cron' = 'manual',
): Promise<SyncResult> {
  const db = getDb();
  const t0 = Date.now();
  const errors: string[] = [];
  let cariPulled = 0;
  let movementsPulled = 0;
  let invoicesPulled = 0;
  let salesPulled = 0;
  let stockPulled = 0;

  // Aynı connection için concurrent sync engelle — non-blocking try-lock
  const lockId = connectionLockId(connectionId);
  const lockResult = await db.execute(sql`SELECT pg_try_advisory_lock(${lockId}) AS locked`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locked = (lockResult as any).rows?.[0]?.locked ?? (lockResult as any)[0]?.locked;
  if (!locked) {
    throw new Error('Bu bağlantı için zaten bir sync çalışıyor');
  }

  try {
  // Connection oku + decrypt config
  const [conn] = await db
    .select()
    .from(erpConnections)
    .where(eq(erpConnections.id, connectionId));
  if (!conn) throw new Error('Connection not found');

  const adapter = getAdapter(conn.provider);
  if (!adapter) throw new Error(`Unknown provider: ${conn.provider}`);

  const config: AdapterConfig = (() => {
    try {
      return JSON.parse(decryptSecret(conn.config_encrypted));
    } catch (err) {
      throw new Error(`Config decrypt edilemedi: ${(err as Error).message}`);
    }
  })();

  // Sync log row açılır
  const [syncLog] = await db
    .insert(erpSyncLogs)
    .values({
      connection_id: connectionId,
      entity_type: 'full',
      trigger,
      status: 'running',
    })
    .returning();

  if (!syncLog) throw new Error('Sync log oluşturulamadı');

  const tenantId = conn.tenant_id;
  if (!tenantId) {
    // org-level — bu MVP'de henüz desteklenmiyor (her connection bir tenant'a bağlı olmalı)
    throw new Error(
      'Tenant ID gerekli: org-level ERP bağlantısı henüz desteklenmiyor. Bağlantıya tenant ata.',
    );
  }

  try {
    // 1. CARI hesapları çek
    let accounts: Awaited<ReturnType<typeof adapter.syncCariAccounts>>;
    try {
      accounts = await adapter.syncCariAccounts(config, { tenantId, connectionId });
    } catch (err) {
      errors.push(`Cari çekme hatası: ${(err as Error).message}`);
      accounts = [];
    }

    // Upsert cari_accounts
    const accountIdByExternal = new Map<string, string>();
    for (const a of accounts) {
      try {
        const [row] = await db
          .insert(cariAccounts)
          .values({
            tenant_id: tenantId,
            connection_id: connectionId,
            external_id: a.external_id,
            code: a.code ?? null,
            name: a.name,
            account_type: a.account_type,
            tax_id: a.tax_id ?? null,
            tax_office: a.tax_office ?? null,
            address: a.address ?? null,
            phone: a.phone ?? null,
            email: a.email ?? null,
            balance: String(a.balance),
            currency: a.currency,
            raw_data: a.raw_data ?? {},
            last_synced_at: new Date(),
          })
          .onConflictDoUpdate({
            target: [cariAccounts.connection_id, cariAccounts.external_id],
            set: {
              code: a.code ?? null,
              name: a.name,
              account_type: a.account_type,
              tax_id: a.tax_id ?? null,
              tax_office: a.tax_office ?? null,
              address: a.address ?? null,
              phone: a.phone ?? null,
              email: a.email ?? null,
              balance: String(a.balance),
              currency: a.currency,
              raw_data: a.raw_data ?? {},
              last_synced_at: new Date(),
              updated_at: new Date(),
            },
          })
          .returning({ id: cariAccounts.id });

        if (row) accountIdByExternal.set(a.external_id, row.id);
        cariPulled++;
      } catch (err) {
        errors.push(`Cari upsert: ${a.external_id} - ${(err as Error).message}`);
      }
    }

    // 2. Her cari için movements çek (sadece son sync'ten sonrası)
    // MVP'de sadece ilk 50 cari için fetch — büyük datasette ayrı job gerekir
    const LIMIT = 50;
    const subset = accounts.slice(0, LIMIT);

    for (const a of subset) {
      const cariId = accountIdByExternal.get(a.external_id);
      if (!cariId) continue;

      // En son hareket tarihi
      const [lastMovement] = await db
        .select({ last: max(cariMovements.movement_date) })
        .from(cariMovements)
        .where(eq(cariMovements.cari_account_id, cariId));

      const since = lastMovement?.last ?? null;

      try {
        const movements = await adapter.syncCariMovements(
          config,
          a.external_id,
          since,
          { tenantId, connectionId },
        );

        for (const m of movements) {
          if (!m.movement_date) continue;
          try {
            await db
              .insert(cariMovements)
              .values({
                tenant_id: tenantId,
                connection_id: connectionId,
                cari_account_id: cariId,
                external_id: m.external_id,
                movement_date: m.movement_date,
                description: m.description ?? null,
                document_no: m.document_no ?? null,
                document_type: m.document_type ?? null,
                debit: String(m.debit),
                credit: String(m.credit),
                balance_after: m.balance_after != null ? String(m.balance_after) : null,
                currency: m.currency,
                raw_data: m.raw_data ?? {},
              })
              .onConflictDoNothing({
                target: [cariMovements.connection_id, cariMovements.external_id],
              });
            movementsPulled++;
          } catch (err) {
            errors.push(
              `Movement insert: ${m.external_id} - ${(err as Error).message.slice(0, 100)}`,
            );
          }
        }
      } catch (err) {
        errors.push(
          `Cari ${a.name} (${a.external_id}) movements: ${(err as Error).message.slice(0, 100)}`,
        );
      }
    }

    // 3. ERP'den faturalari cek (adapter destekliyorsa)
    if (adapter.syncInvoices) {
      try {
        // Son pull edilmis fatura tarihinden sonrasini al (incremental)
        const [lastInvoice] = await db
          .select({ last: max(payableItems.issue_date) })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, tenantId),
              eq(payableItems.erp_connection_id, connectionId),
              isNotNull(payableItems.erp_external_id),
            ),
          );
        const sinceInvoice = lastInvoice?.last ?? null;

        const invoices = await adapter.syncInvoices(config, sinceInvoice, {
          tenantId,
          connectionId,
        });

        for (const inv of invoices) {
          try {
            // Halihazirda Sayman'da bu kayit var mi (erp_external_id + erp_connection_id)
            const existing = await db
              .select({ id: payableItems.id })
              .from(payableItems)
              .where(
                and(
                  eq(payableItems.erp_external_id, inv.external_id),
                  eq(payableItems.erp_connection_id, connectionId),
                ),
              );

            const status: 'pending' | 'paid' | 'partial_paid' =
              inv.payment_status === 'paid'
                ? 'paid'
                : (inv.paid_amount ?? 0) > 0
                  ? 'partial_paid'
                  : 'pending';

            if (existing.length > 0) {
              // Update
              await db
                .update(payableItems)
                .set({
                  title: inv.title,
                  invoice_number: inv.invoice_number ?? null,
                  supplier_name: inv.supplier_name ?? null,
                  issue_date: inv.issue_date ?? null,
                  due_date: inv.due_date ?? null,
                  amount: String(inv.amount),
                  paid_amount: String(inv.paid_amount ?? 0),
                  currency: inv.currency,
                  status,
                  metadata: {
                    source: 'erp_pull',
                    cari_external_id: inv.cari_external_id,
                  },
                  updated_at: new Date(),
                })
                .where(eq(payableItems.id, existing[0]!.id));
            } else {
              // Insert
              await db.insert(payableItems).values({
                tenant_id: tenantId,
                owner_type: 'company',
                title: inv.title,
                invoice_number: inv.invoice_number ?? null,
                supplier_name: inv.supplier_name ?? null,
                issue_date: inv.issue_date ?? null,
                due_date: inv.due_date ?? null,
                amount: String(inv.amount),
                paid_amount: String(inv.paid_amount ?? 0),
                currency: inv.currency,
                status,
                metadata: {
                  source: 'erp_pull',
                  cari_external_id: inv.cari_external_id,
                },
                erp_connection_id: connectionId,
                erp_external_id: inv.external_id,
                erp_push_status: 'pulled',
                erp_pushed_at: new Date(),
              });
            }
            invoicesPulled++;
          } catch (err) {
            errors.push(
              `Invoice ${inv.external_id}: ${(err as Error).message.slice(0, 100)}`,
            );
          }
        }
      } catch (err) {
        errors.push(`syncInvoices: ${(err as Error).message.slice(0, 150)}`);
      }
    }

    // 4. ERP'den SATIS faturalari cek (alacak tarafi)
    if (adapter.syncSalesInvoices) {
      try {
        const [lastSales] = await db
          .select({ last: max(salesInvoices.issue_date) })
          .from(salesInvoices)
          .where(
            and(
              eq(salesInvoices.tenant_id, tenantId),
              eq(salesInvoices.erp_connection_id, connectionId),
              isNotNull(salesInvoices.erp_external_id),
            ),
          );
        const sinceSales = lastSales?.last ?? null;
        const sales = await adapter.syncSalesInvoices(config, sinceSales, {
          tenantId,
          connectionId,
        });

        for (const s of sales) {
          try {
            const existing = await db
              .select({ id: salesInvoices.id })
              .from(salesInvoices)
              .where(
                and(
                  eq(salesInvoices.erp_external_id, s.external_id),
                  eq(salesInvoices.erp_connection_id, connectionId),
                ),
              );

            const status: 'sent' | 'paid' | 'partial_paid' =
              s.payment_status === 'paid'
                ? 'paid'
                : (s.paid_amount ?? 0) > 0
                  ? 'partial_paid'
                  : 'sent';

            if (existing.length > 0) {
              await db
                .update(salesInvoices)
                .set({
                  title: s.title,
                  invoice_number: s.invoice_number ?? null,
                  customer_name: s.customer_name ?? null,
                  issue_date: s.issue_date ?? null,
                  due_date: s.due_date ?? null,
                  amount: String(s.amount),
                  paid_amount: String(s.paid_amount ?? 0),
                  currency: s.currency,
                  status,
                  metadata: {
                    source: 'erp_pull',
                    cari_external_id: s.cari_external_id,
                  },
                  updated_at: new Date(),
                })
                .where(eq(salesInvoices.id, existing[0]!.id));
            } else {
              await db.insert(salesInvoices).values({
                tenant_id: tenantId,
                customer_type: 'company',
                customer_name: s.customer_name ?? null,
                title: s.title,
                invoice_number: s.invoice_number ?? null,
                issue_date: s.issue_date ?? null,
                due_date: s.due_date ?? null,
                amount: String(s.amount),
                paid_amount: String(s.paid_amount ?? 0),
                currency: s.currency,
                status,
                metadata: {
                  source: 'erp_pull',
                  cari_external_id: s.cari_external_id,
                },
                erp_connection_id: connectionId,
                erp_external_id: s.external_id,
                erp_push_status: 'pulled',
                erp_pushed_at: new Date(),
              });
            }
            salesPulled++;
          } catch (err) {
            errors.push(
              `Sales invoice ${s.external_id}: ${(err as Error).message.slice(0, 100)}`,
            );
          }
        }
      } catch (err) {
        errors.push(`syncSalesInvoices: ${(err as Error).message.slice(0, 150)}`);
      }
    }

    // 5. ERP'den STOK bakiyesi cek (urunler)
    if (adapter.syncStock) {
      try {
        const items = await adapter.syncStock(config, { tenantId, connectionId });
        for (const it of items) {
          try {
            await db
              .insert(stockItems)
              .values({
                tenant_id: tenantId,
                connection_id: connectionId,
                external_id: it.external_id,
                code: it.code ?? null,
                name: it.name,
                unit: it.unit ?? null,
                quantity: String(it.quantity),
                purchase_price: it.purchase_price != null ? String(it.purchase_price) : null,
                sale_price: it.sale_price != null ? String(it.sale_price) : null,
                currency: it.currency,
                raw_data: it.raw_data ?? {},
                last_synced_at: new Date(),
              })
              .onConflictDoUpdate({
                target: [stockItems.connection_id, stockItems.external_id],
                set: {
                  code: it.code ?? null,
                  name: it.name,
                  unit: it.unit ?? null,
                  quantity: String(it.quantity),
                  purchase_price: it.purchase_price != null ? String(it.purchase_price) : null,
                  sale_price: it.sale_price != null ? String(it.sale_price) : null,
                  currency: it.currency,
                  raw_data: it.raw_data ?? {},
                  last_synced_at: new Date(),
                  updated_at: new Date(),
                },
              });
            stockPulled++;
          } catch (err) {
            errors.push(`Stock ${it.external_id}: ${(err as Error).message.slice(0, 100)}`);
          }
        }
      } catch (err) {
        errors.push(`syncStock: ${(err as Error).message.slice(0, 150)}`);
      }
    }

    const durationMs = Date.now() - t0;
    const status: 'success' | 'partial' | 'error' =
      errors.length === 0
        ? 'success'
        : cariPulled + invoicesPulled + salesPulled + stockPulled > 0
          ? 'partial'
          : 'error';

    // Log + connection durumu güncelle
    await db
      .update(erpSyncLogs)
      .set({
        status,
        records_pulled: String(
          cariPulled + movementsPulled + invoicesPulled + salesPulled + stockPulled,
        ),
        duration_ms: String(durationMs),
        error_message: errors.length > 0 ? errors.slice(0, 5).join(' | ').slice(0, 1000) : null,
        details: {
          cari_pulled: cariPulled,
          movements_pulled: movementsPulled,
          invoices_pulled: invoicesPulled,
          sales_pulled: salesPulled,
          stock_pulled: stockPulled,
        },
        completed_at: new Date(),
      })
      .where(eq(erpSyncLogs.id, syncLog.id));

    await db
      .update(erpConnections)
      .set({
        last_sync_at: new Date(),
        last_sync_status: status,
        last_sync_error: errors.length > 0 ? errors[0]!.slice(0, 500) : null,
        sync_count: sql`${erpConnections.sync_count} + 1`,
        status: status === 'error' ? 'error' : 'active',
        updated_at: new Date(),
      })
      .where(eq(erpConnections.id, connectionId));

    logger.info(
      {
        connectionId,
        status,
        cariPulled,
        movementsPulled,
        invoicesPulled,
        salesPulled,
        stockPulled,
        durationMs,
      },
      'ERP sync completed',
    );

    return {
      connection_id: connectionId,
      status,
      cari_pulled: cariPulled,
      movements_pulled: movementsPulled,
      invoices_pulled: invoicesPulled,
      sales_pulled: salesPulled,
      stock_pulled: stockPulled,
      errors,
      duration_ms: durationMs,
    };
  } catch (err) {
    const errMsg = (err as Error).message;
    await db
      .update(erpSyncLogs)
      .set({
        status: 'error',
        error_message: errMsg.slice(0, 1000),
        completed_at: new Date(),
        duration_ms: String(Date.now() - t0),
      })
      .where(eq(erpSyncLogs.id, syncLog.id));

    await db
      .update(erpConnections)
      .set({
        last_sync_at: new Date(),
        last_sync_status: 'error',
        last_sync_error: errMsg.slice(0, 500),
        status: 'error',
        updated_at: new Date(),
      })
      .where(eq(erpConnections.id, connectionId));

    throw err;
  }
  } finally {
    // Advisory lock release — sync başarılı ya da hatalı, lock'u bırak
    await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`).catch(() => null);
  }
}
