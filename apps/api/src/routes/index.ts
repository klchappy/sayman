import { Router } from 'express';
import { tenantContext } from '../middleware/tenant-context';
import { healthRouter } from './health';
import { meRouter } from './me';
import { organizationsRouter } from './organizations';
import { tenantsRouter } from './tenants';
import { personsRouter } from './master-data/persons';
import { companiesRouter } from './master-data/companies';
import { payablesRouter, paymentsRouter } from './finance';

export const apiRouter = Router();

// Tenant context her endpoint için resolve edilir (boş bile olsa)
apiRouter.use(tenantContext);

apiRouter.use(healthRouter);
apiRouter.use(meRouter);
apiRouter.use(organizationsRouter);
apiRouter.use(tenantsRouter);

// Master data (organization-scope, share_scope filtreli)
apiRouter.use(personsRouter);
apiRouter.use(companiesRouter);

// Finance (tenant-scope)
apiRouter.use(payablesRouter);
apiRouter.use(paymentsRouter);
