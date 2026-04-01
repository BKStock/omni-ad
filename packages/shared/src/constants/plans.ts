import type { PlanTier } from '../types/organization.js';

interface PlanLimits {
  maxMonthlyAdSpend: number;
  maxChannels: number;
  maxCreativeGenerations: number;
  features: string[];
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    maxMonthlyAdSpend: 300_000,
    maxChannels: 2,
    maxCreativeGenerations: 20,
    features: [
      'basic_analytics',
      'manual_budget',
      'creative_editor',
      'email_support',
    ],
  },
  pro: {
    maxMonthlyAdSpend: 1_000_000,
    maxChannels: 4,
    maxCreativeGenerations: 100,
    features: [
      'basic_analytics',
      'advanced_analytics',
      'manual_budget',
      'ai_budget_optimizer',
      'creative_editor',
      'ai_creative_generation',
      'funnel_builder',
      'email_support',
      'chat_support',
    ],
  },
  business: {
    maxMonthlyAdSpend: 5_000_000,
    maxChannels: 7,
    maxCreativeGenerations: 500,
    features: [
      'basic_analytics',
      'advanced_analytics',
      'realtime_analytics',
      'manual_budget',
      'ai_budget_optimizer',
      'predictive_budget',
      'creative_editor',
      'ai_creative_generation',
      'funnel_builder',
      'audience_builder',
      'cross_platform_attribution',
      'custom_reports',
      'email_support',
      'chat_support',
      'phone_support',
    ],
  },
  enterprise: {
    // Unlimited represented as Number.MAX_SAFE_INTEGER
    maxMonthlyAdSpend: Number.MAX_SAFE_INTEGER,
    maxChannels: 7,
    maxCreativeGenerations: Number.MAX_SAFE_INTEGER,
    features: [
      'basic_analytics',
      'advanced_analytics',
      'realtime_analytics',
      'manual_budget',
      'ai_budget_optimizer',
      'predictive_budget',
      'creative_editor',
      'ai_creative_generation',
      'funnel_builder',
      'audience_builder',
      'cross_platform_attribution',
      'custom_reports',
      'white_label',
      'sso',
      'api_access',
      'custom_integrations',
      'dedicated_account_manager',
      'sla_guarantee',
      'email_support',
      'chat_support',
      'phone_support',
    ],
  },
};
