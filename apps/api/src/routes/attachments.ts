/**
 * /v1/attachments — polimorfik dosya yükleme (Supabase Storage backed).
 *
 *   POST   /v1/attachments?related_table=X&related_id=Y  (multipart/form-data, field: file)
 *   GET    /v1/attachments?related_table=X&related_id=Y
 *   GET    /v1/attachments/:id/url     → 1 saatlik signed URL
 *   DELETE /v1/attachments/:id
 *
 * Polimorfik FK: payable_items, guarantees, subscriptions, regular_payment_profiles,
 * official_payment_profiles
 *
 * Supabase Storage bucket: `sayman-attachments` (private, 20MB limit).
 * Dosya path: `<tenant_id>/<related_table>/<related_id>/<uuid>.<ext>`
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { attachments, getDb } from '@sayman/db';
import { env, isConfigured } from '../config/env';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const BUCKET = 'sayman-attachments';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TABLES = new Set([
  'payable_items',
  'guarantees',
  'subscriptions',
  'regular_payment_profiles',
  'official_payment_profiles',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function getStorage() {
  if (!isConfigured.supabase) {
    throw new HttpError(503, 'Supabase Storage yapılandırılmamış', 'NO_SUPABASE');
  }
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage;
}

export const attachmentsRouter = Router();

// LIST
attachmentsRouter.get('/attachments', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const relatedTable = String(req.query.related_table ?? '');
    const relatedId = String(req.query.related_id ?? '');
    if (!ALLOWED_TABLES.has(relatedTable)) {
      throw new HttpError(400, `Geçersiz related_table: ${relatedTable}`, 'INVALID_TABLE');
    }
    if (!relatedId) throw new HttpError(400, 'related_id gerekli', 'NO_ID');

    const db = getDb();
    const rows = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.tenant_id, req.activeTenantId!),
          eq(attachments.related_table, relatedTable),
          eq(attachments.related_id, relatedId),
        ),
      )
      .orderBy(desc(attachments.created_at));
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// UPLOAD
attachmentsRouter.post(
  '/attachments',
  requireAuth,
  requireTenant,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const relatedTable = String(req.query.related_table ?? req.body.related_table ?? '');
      const relatedId = String(req.query.related_id ?? req.body.related_id ?? '');
      const description: string | null = (req.body.description ?? null) as string | null;

      if (!ALLOWED_TABLES.has(relatedTable)) {
        throw new HttpError(400, `Geçersiz related_table: ${relatedTable}`, 'INVALID_TABLE');
      }
      if (!relatedId) throw new HttpError(400, 'related_id gerekli', 'NO_ID');
      if (!req.file) throw new HttpError(400, 'Dosya gerekli (field name: file)', 'NO_FILE');

      const file = req.file;
      const ext = file.originalname.split('.').pop() ?? 'bin';
      const uuid = crypto.randomUUID();
      const filePath = `${req.activeTenantId}/${relatedTable}/${relatedId}/${uuid}.${ext}`;

      // Storage upload
      const storage = getStorage();
      const { error: upErr } = await storage.from(BUCKET).upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
      if (upErr) {
        throw new HttpError(500, `Storage upload hatası: ${upErr.message}`, 'STORAGE_FAIL');
      }

      // DB record
      const db = getDb();
      const [row] = await db
        .insert(attachments)
        .values({
          tenant_id: req.activeTenantId!,
          related_table: relatedTable,
          related_id: relatedId,
          file_path: filePath,
          file_name: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          description,
          uploaded_by: req.authUser?.id ?? null,
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'attachment.upload',
        target_type: relatedTable,
        target_id: relatedId,
        details: { file_name: file.originalname, size_bytes: file.size },
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// GET signed URL (1 saat)
attachmentsRouter.get('/attachments/:id/url', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [att] = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.id, String(req.params.id ?? '')),
          eq(attachments.tenant_id, req.activeTenantId!),
        ),
      );
    if (!att) throw new HttpError(404, 'Eklenti bulunamadı', 'NOT_FOUND');

    const storage = getStorage();
    const { data, error } = await storage.from(BUCKET).createSignedUrl(att.file_path, 3600);
    if (error || !data) {
      throw new HttpError(500, `Signed URL hatası: ${error?.message ?? '-'}`, 'SIGN_FAIL');
    }
    res.json({ data: { url: data.signedUrl, expires_in: 3600, file_name: att.file_name } });
  } catch (err) {
    next(err);
  }
});

// DELETE (DB + Storage)
attachmentsRouter.delete('/attachments/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [att] = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.id, String(req.params.id ?? '')),
          eq(attachments.tenant_id, req.activeTenantId!),
        ),
      );
    if (!att) throw new HttpError(404, 'Eklenti bulunamadı', 'NOT_FOUND');

    // Storage remove (best-effort)
    try {
      await getStorage().from(BUCKET).remove([att.file_path]);
    } catch {
      // best-effort
    }

    await db.delete(attachments).where(eq(attachments.id, att.id));

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'attachment.delete',
      target_type: att.related_table,
      target_id: att.related_id,
      details: { file_name: att.file_name },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
