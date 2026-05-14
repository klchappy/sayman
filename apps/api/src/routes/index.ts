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
