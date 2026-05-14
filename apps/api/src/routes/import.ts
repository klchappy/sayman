/**
 * /v1/import/:resource — CSV/JSON bulk insert.
 *
 *   POST /v1/import/:resource
 *   Body: { format: 'csv' | 'json', data: string | array, dry_run: boolean }
 *
 *   resource ∈ persons, companies, properties, payables, subscriptions,
 *              regular-payments, guarantees
 */
import { parse as parseCsv } from 'csv-parse/sync';
import { Router } from 'express';
import { z } from 'zod';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { IMPORT_HANDLERS, IMPORT_RESOURCES } from '../lib/import-handlers';
import { requireAuth } from '../middleware/auth';
import { requirePerm } from '../middleware/permission';

const MAX_ROWS = 500;

const bodySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  data: z.union([z.string(), z.array(z.any())]),
  dry_run: z.boolean().default(true),
});

export const importRouter = Router();

importRouter.post(
  '/import/:resource',
  requireAuth,
  requireOrg,
  requirePerm('master_data.write'),
  async (req, res, next) => {
    try {
      const resource = String(req.params.resource ?? '');
      const handler = IMPORT_HANDLERS[resource];
      if (!handler) {
        throw new HttpError(
          400,
          `Bilinmeyen resource: ${resource}. Olası: ${IMPORT_RESOURCES.join(', ')}`,
          'INVALID_RESOURCE',
        );
      }

      const ctx = req.saymanContext;
      if (handler.scope === 'tenant' && !ctx?.tenantId) {
        throw new HttpError(400, 'Bu resource tenant context gerektirir', 'NO_TENANT');
      }

      const body = bodySchema.parse(req.body);

      // Format → JSON array
      let rows: unknown[];
      if (body.format === 'csv') {
        if (typeof body.data !== 'string') throw new HttpError(400, 'CSV format için data string olmalı', 'BAD_CSV');
        try {
          rows = parseCsv(body.data, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
          }) as unknown[];
        } catch (e) {
          throw new HttpError(400, `CSV parse hatası: ${(e as Error).message}`, 'CSV_PARSE');
        }
      } else {
        if (!Array.isArray(body.data)) throw new HttpError(400, 'JSON format için data array olmalı', 'BAD_JSON');
        rows = body.data;
      }

      if (rows.length === 0) throw new HttpError(400, 'Boş veri', 'EMPTY');
      if (rows.length > MAX_ROWS) {
        throw new HttpError(400, `Maks ${MAX_ROWS} satır (gönderilen: ${rows.length})`, 'TOO_LARGE');
      }

      // Validation: her satırı zod parse et
      const valid: any[] = [];
      const errors: Array<{ row: number; error: string; data?: unknown }> = [];

      for (let i = 0; i < rows.length; i++) {
        const result = handler.schema.safeParse(rows[i]);
        if (result.success) {
          valid.push(result.data);
        } else {
          errors.push({
            row: i + 1,
            error: result.error.issues
              .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
              .join(', '),
            data: rows[i],
          });
        }
      }

      // Dry-run
      if (body.dry_run) {
        res.json({
          data: {
            resource,
            dry_run: true,
            total: rows.length,
            valid: valid.length,
            invalid: errors.length,
            errors: errors.slice(0, 50),
            preview: valid.slice(0, 5),
          },
        });
        return;
      }

      // Real insert
      if (valid.length === 0) {
        throw new HttpError(400, 'Geçerli satır yok', 'NO_VALID_ROWS');
      }

      const insertedIds = await handler.insert(valid, {
        orgId: req.activeOrgId!,
        tenantId: req.saymanContext?.tenantId ?? undefined,
      });

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'import.bulk',
        target_type: resource,
        details: {
          format: body.format,
          total: rows.length,
          inserted: insertedIds.length,
          errors_count: errors.length,
        },
      });

      res.json({
        data: {
          resource,
          dry_run: false,
          total: rows.length,
          inserted: insertedIds.length,
          invalid: errors.length,
          errors: errors.slice(0, 50),
          inserted_ids: insertedIds,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /import/resources — UI dropdown için
importRouter.get('/import/resources', requireAuth, async (_req, res) => {
  const list = Object.entries(IMPORT_HANDLERS).map(([key, cfg]) => ({
    resource: key,
    scope: cfg.scope,
    description: cfg.description,
  }));
  res.json({ data: list });
});
