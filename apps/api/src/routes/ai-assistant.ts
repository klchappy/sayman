/**
 * /v1/ai/ask — Doğal dil sorgu → Claude API → yapılandırılmış cevap.
 *
 * Senaryo:
 *   Kullanıcı: "Bu ay vadesi geçen 1000 TL üstü faturaları göster"
 *   → Claude → tool_use: query_payables({ status: 'overdue', min_amount: 1000, due_within: '30d' })
 *   → Sayman çalıştırır → sonuç + kullanıcıya doğal dil yanıt
 *
 * Tool registry — Claude'a verilen "what I can do" listesi.
 * Bu MVP: 3 tool (payables, guarantees, dashboard).
 *
 * Auth: requireOrg. AI kullanımı pahalı, rate-limit 30/saat/user.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  getDb,
  guarantees,
  payableItems,
} from '@sayman/db';
import { env, isConfigured } from '../config/env';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';

export const aiAssistantRouter = Router();

// === Tool tanımları (Claude tool_use schema'ları) ===
const TOOLS = [
  {
    name: 'query_payables',
    description:
      'Faturaları sorgula. Status, vade aralığı, min/max tutar, kategori, supplier ile filtre. Tenant context içinde çalışır.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approaching', 'overdue', 'paid', 'partial_paid'],
          description: 'Fatura durumu',
        },
        min_amount: { type: 'number', description: 'Minimum tutar TL' },
        max_amount: { type: 'number', description: 'Maximum tutar TL' },
        due_within_days: { type: 'number', description: 'Vadesi N gün içinde olanlar' },
        category: { type: 'string', description: 'Kategori (elektrik, kira, vergi, vb.)' },
        supplier_name_contains: { type: 'string', description: 'Tedarikçi adında geçen kelime' },
        limit: { type: 'number', description: 'Max sonuç (default 20, max 100)' },
      },
    },
  },
  {
    name: 'query_guarantees',
    description: 'Teminat mektuplarını sorgula. Durum + vade kalan gün ile filtre.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'returned', 'expired', 'cancelled'],
        },
        expiring_within_days: { type: 'number', description: 'Vadesi N gün içinde dolan' },
        min_amount: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_dashboard_summary',
    description: 'Tenant özet KPI: toplam fatura, açık bakiye, geciken sayısı, abonelik, teminat.',
    input_schema: { type: 'object', properties: {} },
  },
];

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; content: string }
  >;
}

async function callClaude(messages: ClaudeMessage[]): Promise<ClaudeMessage> {
  if (!isConfigured.ai) throw new HttpError(503, 'AI asistan yapılandırılmamış', 'NO_AI');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:
        'Sen Sayman muhasebe SaaS\'inin Türkçe AI asistanısın. Kullanıcı doğal dilde sorgu yapar (örn "bu ay vadesi geçen faturalar"). ' +
        'Tools kullanarak DB sorgusu yapıp Türkçe ve kısa bir yanıt ver. Sayıları TL formatla. Yanıtları madde madde, NET. ' +
        'Para birimi: TRY. Bugün ' +
        new Date().toISOString().slice(0, 10) +
        '. Tarih hesaplamalarında bunu kullan.',
      tools: TOOLS,
      messages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new HttpError(500, `Claude API hatası: ${txt.slice(0, 200)}`, 'AI_FAIL');
  }

  const data = (await res.json()) as {
    content: ClaudeMessage['content'];
    stop_reason: string;
  };
  return { role: 'assistant', content: data.content };
}

async function runTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: { tenantId: string },
): Promise<string> {
  const db = getDb();
  const today = new Date();
  const dateStr = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  if (toolName === 'query_payables') {
    const conditions: any[] = [
      eq(payableItems.tenant_id, ctx.tenantId),
      eq(payableItems.is_active, true),
    ];
    if (input.status) conditions.push(eq(payableItems.status, input.status as any));
    if (input.min_amount !== undefined)
      conditions.push(gte(payableItems.amount, String(input.min_amount)));
    if (input.max_amount !== undefined)
      conditions.push(lte(payableItems.amount, String(input.max_amount)));
    if (input.due_within_days !== undefined) {
      conditions.push(lte(payableItems.due_date, dateStr(Number(input.due_within_days))));
      conditions.push(gte(payableItems.due_date, dateStr(0)));
    }
    if (input.category) conditions.push(eq(payableItems.category, String(input.category)));
    if (input.supplier_name_contains) {
      conditions.push(
        sql`f_unaccent(${payableItems.supplier_name}) ILIKE f_unaccent(${'%' + String(input.supplier_name_contains) + '%'})`,
      );
    }
    const limit = Math.min(Number(input.limit ?? 20), 100);
    const rows = await db
      .select({
        id: payableItems.id,
        title: payableItems.title,
        amount: payableItems.amount,
        paid_amount: payableItems.paid_amount,
        due_date: payableItems.due_date,
        status: payableItems.status,
        supplier_name: payableItems.supplier_name,
        category: payableItems.category,
      })
      .from(payableItems)
      .where(and(...conditions))
      .limit(limit);
    return JSON.stringify({ rows, count: rows.length });
  }

  if (toolName === 'query_guarantees') {
    const conditions: any[] = [
      eq(guarantees.tenant_id, ctx.tenantId),
      eq(guarantees.is_active, true),
    ];
    if (input.status) conditions.push(eq(guarantees.status, input.status as any));
    if (input.min_amount !== undefined)
      conditions.push(gte(guarantees.amount, String(input.min_amount)));
    if (input.expiring_within_days !== undefined) {
      conditions.push(lte(guarantees.expiry_date, dateStr(Number(input.expiring_within_days))));
      conditions.push(gte(guarantees.expiry_date, dateStr(0)));
    }
    const limit = Math.min(Number(input.limit ?? 20), 100);
    const rows = await db
      .select({
        id: guarantees.id,
        beneficiary_name: guarantees.beneficiary_name,
        letter_no: guarantees.letter_no,
        amount: guarantees.amount,
        expiry_date: guarantees.expiry_date,
        status: guarantees.status,
      })
      .from(guarantees)
      .where(and(...conditions))
      .limit(limit);
    return JSON.stringify({ rows, count: rows.length });
  }

  if (toolName === 'get_dashboard_summary') {
    const [r] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payableItems.amount}), 0)`,
        paid: sql<string>`COALESCE(SUM(${payableItems.paid_amount}), 0)`,
        overdue: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.status} = 'overdue')`,
        approaching: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.status} = 'approaching')`,
        count: sql<string>`COUNT(*)`,
      })
      .from(payableItems)
      .where(and(eq(payableItems.tenant_id, ctx.tenantId), eq(payableItems.is_active, true)));
    return JSON.stringify({
      total_amount: Number(r?.total ?? 0),
      paid_amount: Number(r?.paid ?? 0),
      open_balance: Number(r?.total ?? 0) - Number(r?.paid ?? 0),
      payable_count: Number(r?.count ?? 0),
      overdue_count: Number(r?.overdue ?? 0),
      approaching_count: Number(r?.approaching ?? 0),
    });
  }

  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

const askSchema = z.object({
  query: z.string().min(2).max(500),
});

aiAssistantRouter.post('/ai/ask', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!isConfigured.ai) {
      throw new HttpError(503, 'AI asistan yapılandırılmamış (ANTHROPIC_API_KEY)', 'NO_AI');
    }
    const tenantId = req.saymanContext?.tenantId;
    if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

    const body = askSchema.parse(req.body);
    consumeRateLimit({
      identifier: `ai:${req.authUser!.id}`,
      limit: 30,
      window_seconds: 3600,
    });

    const messages: ClaudeMessage[] = [
      { role: 'user', content: [{ type: 'text', text: body.query }] },
    ];

    // Tool-use loop: max 5 iter
    let iter = 0;
    let finalText = '';
    const toolCalls: Array<{ name: string; input: any; result?: any }> = [];
    while (iter < 5) {
      iter++;
      const reply = await callClaude(messages);
      messages.push(reply);

      // Text + tool_use'ları parçala
      const textParts = reply.content
        .filter((c) => c.type === 'text')
        .map((c) => (c as any).text)
        .join('\n');
      const toolUses = reply.content.filter((c) => c.type === 'tool_use') as Array<{
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }>;

      if (textParts) finalText = textParts;

      if (toolUses.length === 0) break;

      // Tool'ları çalıştır
      const toolResults: ClaudeMessage['content'] = [];
      for (const tu of toolUses) {
        const out = await runTool(tu.name, tu.input, { tenantId });
        toolCalls.push({ name: tu.name, input: tu.input, result: JSON.parse(out) });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: out,
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'ai.ask',
      details: { query: body.query, iterations: iter, tool_count: toolCalls.length },
    });

    res.json({
      data: {
        query: body.query,
        answer: finalText || '(Asistan yanıt üretmedi)',
        tool_calls: toolCalls,
        iterations: iter,
      },
    });
  } catch (err) {
    next(err);
  }
});

aiAssistantRouter.get('/ai/status', requireAuth, async (_req, res) => {
  res.json({ data: { configured: isConfigured.ai } });
});
