import { pgEnum } from 'drizzle-orm/pg-core';

export const platformEnum = pgEnum('platform', [
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
]);

export const platformStatusEnum = pgEnum('platform_status', [
  'active',
  'expired',
  'revoked',
  'error',
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'error',
]);

export const campaignObjectiveEnum = pgEnum('campaign_objective', [
  'awareness',
  'traffic',
  'engagement',
  'leads',
  'conversion',
  'retargeting',
]);

export const creativeTypeEnum = pgEnum('creative_type', [
  'text',
  'image',
  'video',
  'carousel',
]);

export const planTierEnum = pgEnum('plan_tier', [
  'starter',
  'pro',
  'business',
  'enterprise',
]);

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'manager',
  'analyst',
  'creative',
]);

export const funnelStatusEnum = pgEnum('funnel_status', [
  'draft',
  'active',
  'paused',
]);

export const attributionModelEnum = pgEnum('attribution_model', [
  'markov',
  'shapley',
  'linear',
  'last_click',
  'first_click',
]);

export const touchpointTypeEnum = pgEnum('touchpoint_type', [
  'impression',
  'click',
  'view',
  'conversion',
]);
