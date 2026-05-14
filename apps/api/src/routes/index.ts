import { Router } from 'express';
import { tenantContext } from '../middleware/tenant-context';
import { healthRouter } from './health';
import { meRouter } from './me';
import { organizationsRouter } from './organizations';
import { tenantsRouter } from './tenants';

export const apiRouter = Router();

// Tenant context her endpoint için resolve edilir (boş bile olsa)
apiRouter.use(tenantContext);

apiRouter.use(healthRouter);
apiRouter.use(meRouter);
apiRouter.use(organizationsRouter);
apiRouter.use(tenantsRouter);
