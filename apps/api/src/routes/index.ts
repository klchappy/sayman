import { Router } from 'express';
import { tenantContext } from '../middleware/tenant-context';
import { authLocalRouter } from './auth-local';
import { healthRouter } from './health';
import { meRouter } from './me';
import { organizationsRouter } from './organizations';
import { securityRouter } from './security';
import { tenantsRouter } from './tenants';
import { banksRouter } from './master-data/banks';
import { companiesRouter } from './master-data/companies';
import { institutionsRouter } from './master-data/institutions';
import { personsRouter } from './master-data/persons';
import { propertiesRouter } from './master-data/properties';
import { payablesRouter, paymentsRouter } from './finance';
import { tasksRouter } from './tasks';
import { notificationsRouter } from './notifications';
import { subscriptionsRouter } from './subscriptions';
import { regularPaymentsRouter } from './regular-payments';
import { officialPaymentsRouter } from './official-payments';
import { guaranteesRouter } from './guarantees';
import { usersRouter } from './users';
import { jobsRouter } from './jobs';
import { dashboardRouter } from './dashboard';
import { subsidiariesRouter } from './subsidiaries';
import { searchRouter } from './search';
import { pdfRouter } from './pdf';
import { apiTokensRouter } from './api-tokens';
import { attachmentsRouter } from './attachments';
import { efaturaRouter } from './efatura';
import { fxRatesRouter } from './fx-rates';
import { webhooksRouter } from './webhooks';
import { reportsRouter } from './reports';
import { openApiRouter } from './openapi';
import { realtimeRouter } from './realtime';
import { smartImportRouter } from './smart-import';
import { similarRouter } from './similar';
import { aiAssistantRouter } from './ai-assistant';
import { categoryFeedbackRouter } from './category-feedback';
import { inboundWebhooksRouter } from './inbound-webhooks';
import { aiSummaryRouter } from './ai-summary';
import { forecastRouter } from './forecast';
import { semanticSearchRouter } from './semantic-search';
import { integrationsStatusRouter } from './integrations-status';
import { integrationCredentialsRouter } from './integration-credentials';
import { whatsappRouter } from './whatsapp';
import { pushRouter } from './push';
import { aiExplainRouter } from './ai-explain';
import { supplierScorecardRouter } from './supplier-scorecard';
import { inboxRouter } from './inbox';
import { excelExportRouter } from './excel-export';
import { recurringDetectRouter } from './recurring-detect';
import { paymentApprovalsRouter } from './payment-approvals';
import { erpRouter } from './erp';
import { erpPushRouter } from './erp-push';
import { cariRouter } from './cari';
import { salesInvoicesRouter } from './sales-invoices';
import { stockRouter } from './stock';
import { taxCalendarRouter } from './tax-calendar';
import { budgetsRouter } from './budgets';
import { reconciliationRouter } from './reconciliation';
import { customerPortalRouter } from './customer-portal';
import { checksRouter } from './checks';
import { collectionRemindersRouter } from './collection-reminders';
import { fixedAssetsRouter } from './fixed-assets';
import { reportsPnlRouter } from './reports-pnl';
import { employeesRouter } from './employees';
import { payrollRouter } from './payroll';
import { payrollPdfRouter } from './payroll-pdf';
import { activityTimelineRouter } from './activity-timeline';
import { reportsBalanceRouter } from './reports-balance';
import { riskScoreRouter } from './risk-score';
import { savedSearchesRouter } from './saved-searches';
import { reviewQueueRouter } from './review-queue';
import { supportRouter } from './support';

export const apiRouter = Router();

// Tenant context her endpoint için resolve edilir (boş bile olsa)
apiRouter.use(tenantContext);

apiRouter.use(healthRouter);
apiRouter.use(meRouter);
apiRouter.use(authLocalRouter);
apiRouter.use(securityRouter);
apiRouter.use(organizationsRouter);
apiRouter.use(tenantsRouter);

// Master data (organization-scope, share_scope filtreli where applicable)
apiRouter.use(personsRouter);
apiRouter.use(companiesRouter);
apiRouter.use(propertiesRouter);
apiRouter.use(banksRouter);
apiRouter.use(institutionsRouter);

// Finance (tenant-scope)
apiRouter.use(payablesRouter);
apiRouter.use(paymentsRouter);

// Operasyon (tenant-scope + user-scope)
apiRouter.use(tasksRouter);
apiRouter.use(notificationsRouter);

// Yinelenen ödeme modülleri (tenant-scope)
apiRouter.use(subscriptionsRouter);
apiRouter.use(regularPaymentsRouter);
apiRouter.use(officialPaymentsRouter);
apiRouter.use(guaranteesRouter);

// Kullanıcı yönetimi (org-scope + invite akışı)
apiRouter.use(usersRouter);

// Cron manuel tetik (super_admin)
apiRouter.use(jobsRouter);

// Dashboard KPI aggregation (tenant-scope)
apiRouter.use(dashboardRouter);

// Subsidiaries (Faz M) — Tenant içinde yan şirket / şube
apiRouter.use(subsidiariesRouter);

// Global search (Cmd+K)
apiRouter.use(searchRouter);

// PDF export (fatura/teminat)
apiRouter.use(pdfRouter);

// API tokens (programmatic erisim)
apiRouter.use(apiTokensRouter);

// Dosya ekleri (Supabase Storage)
apiRouter.use(attachmentsRouter);

// e-Fatura UBL/XML import (GIB)
apiRouter.use(efaturaRouter);

// FX rates (TCMB)
apiRouter.use(fxRatesRouter);

// Outbound webhooks
apiRouter.use(webhooksRouter);

// PDF rapor uretici
apiRouter.use(reportsRouter);

// OpenAPI / Swagger
apiRouter.use(openApiRouter);

// Realtime (SSE) bildirim akisi
apiRouter.use(realtimeRouter);

// Smart import: tek dosya, auto-detect tip + yonlendirme
apiRouter.use(smartImportRouter);

// Benzer faturalar (metadata score)
apiRouter.use(similarRouter);

// AI asistan (Claude API doğal dil sorgu)
apiRouter.use(aiAssistantRouter);

// AI kategori düzeltme feedback
apiRouter.use(categoryFeedbackRouter);

// Inbound webhooks (Damga/n8n/Zapier'den gelen POST)
apiRouter.use(inboundWebhooksRouter);

// Günlük AI özet (cron + endpoint)
apiRouter.use(aiSummaryRouter);

// Forecasting (lineer regresyon nakit projeksiyon)
apiRouter.use(forecastRouter);

// Semantic search (Voyage embeddings + pgvector)
apiRouter.use(semanticSearchRouter);

// Entegrasyon hub durum endpoint'i
apiRouter.use(integrationsStatusRouter);

// Org-default + tenant-override credential yönetimi
apiRouter.use(integrationCredentialsRouter);

// WhatsApp Business Cloud API (inbound + test)
apiRouter.use(whatsappRouter);

// Mobil/web push token kayıt
apiRouter.use(pushRouter);

// AI: belirli payable için "niye anomali?" Claude açıklaması
apiRouter.use(aiExplainRouter);

// Tedarikçi performans karnesi
apiRouter.use(supplierScorecardRouter);

// Eylem-odaklı inbox (bugün ne yapmam gerek)
apiRouter.use(inboxRouter);

// Excel (xlsx) export — faturalar/ödemeler/teminat
apiRouter.use(excelExportRouter);

// Recurring (tekrar eden fatura) tespiti
apiRouter.use(recurringDetectRouter);

// Çift onaylı ödeme akışı (>= 50K TRY)
apiRouter.use(paymentApprovalsRouter);

// ERP bağlantı yönetimi (Paraşüt, Logo, Manuel CSV)
apiRouter.use(erpRouter);

// ERP push — Sayman → muhasebe yazılımı (çift yönlü)
apiRouter.use(erpPushRouter);

// Cari hesap + ekstre okuma
apiRouter.use(cariRouter);

// Satış faturaları (alacak tarafı)
apiRouter.use(salesInvoicesRouter);

// Stok bakiyesi (ERP'den pull)
apiRouter.use(stockRouter);

// Türk vergi takvimi (auto + manuel)
apiRouter.use(taxCalendarRouter);

// Bütçe planlama (kategori bazlı)
apiRouter.use(budgetsRouter);

// Mutabakat (cari ↔ Sayman eşleştirme)
apiRouter.use(reconciliationRouter);

// Müşteri portali (public link ile cari paylaşımı)
apiRouter.use(customerPortalRouter);

// Çek/Senet takibi
apiRouter.use(checksRouter);

// Tahsilat hatırlatma kuralları + logları
apiRouter.use(collectionRemindersRouter);

// Demirbaş ve amortisman
apiRouter.use(fixedAssetsRouter);

// Gelir-Gider tablosu (P&L)
apiRouter.use(reportsPnlRouter);

// Personel
apiRouter.use(employeesRouter);

// Maaş bordrosu
apiRouter.use(payrollRouter);

// Aktivite zaman çizelgesi (audit log + payments)
apiRouter.use(activityTimelineRouter);

// Maaş pusulası PDF
apiRouter.use(payrollPdfRouter);

// Bilanço raporu
apiRouter.use(reportsBalanceRouter);

// AI risk skoru (cari profili)
apiRouter.use(riskScoreRouter);

// Kayıtlı filtreler
apiRouter.use(savedSearchesRouter);

// Review queue (otomatik yaratılan kayıt doğrulama)
apiRouter.use(reviewQueueRouter);

// Destek talepleri (manuel + ErrorBoundary auto + 500 auto)
apiRouter.use(supportRouter);
