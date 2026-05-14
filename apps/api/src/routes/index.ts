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
import { importRouter } from './import';
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

// Import Center — CSV/JSON bulk insert
apiRouter.use(importRouter);

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
