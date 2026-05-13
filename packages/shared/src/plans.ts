import { z } from 'zod';

export const PLANS = ['trial', 'basic', 'pro', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];
export const planSchema = z.enum(PLANS);

export const PLAN_LABELS: Record<Plan, string> = {
  trial: 'Deneme (14 gün)',
  basic: 'Temel',
  pro: 'Pro',
  enterprise: 'Kurumsal',
};
