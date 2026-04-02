import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { platformEnum } from './enums';
import { organizations } from './organizations';
import { platformConnections } from './platforms';

// ---------------------------------------------------------------------------
// JSONB column types
// ---------------------------------------------------------------------------

export interface AccountSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  totalSpend30d: number;
  avgDailySpend: number;
  avgRoas: number;
  avgCtr: number;
  avgCpc: number;
  topObjective: string;
}

export interface ExistingCampaignEntry {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget: number;
  spend30d: number;
  roas: number;
  ctr: number;
  impressions: number;
}

export interface SpendingPattern {
  dailyTrend: number[];
  weekdayAvg: Record<string, number>;
  peakDay: string;
  lowDay: string;
  spendConsistency: number;
}

export interface PerformanceDiagnosisEntry {
  name: string;
  roas: number;
  reason: string;
}

export interface UnderPerformerEntry {
  name: string;
  roas: number;
  issue: string;
}

export interface PerformanceDiagnosis {
  topPerformers: PerformanceDiagnosisEntry[];
  underPerformers: UnderPerformerEntry[];
  opportunities: string[];
}

export interface ImprovementEntry {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedImpact?: string;
  actionType?: string;
}

export interface RiskEntry {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedCampaigns?: string[];
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const accountAnalyses = pgTable(
  'account_analyses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    platformConnectionId: uuid('platform_connection_id')
      .notNull()
      .references(() => platformConnections.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    accountId: text('account_id').notNull(),
    accountName: text('account_name').notNull(),
    summary: jsonb('summary').$type<AccountSummary>().notNull(),
    existingCampaigns: jsonb('existing_campaigns')
      .$type<ExistingCampaignEntry[]>()
      .notNull(),
    spendingPattern: jsonb('spending_pattern')
      .$type<SpendingPattern>()
      .notNull(),
    performanceDiagnosis: jsonb('performance_diagnosis')
      .$type<PerformanceDiagnosis>()
      .notNull(),
    improvements: jsonb('improvements')
      .$type<ImprovementEntry[]>()
      .notNull(),
    risks: jsonb('risks').$type<RiskEntry[]>().notNull(),
    overallScore: real('overall_score').notNull(),
    aiSummary: text('ai_summary').notNull(),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('account_analyses_org_connection_idx').on(
      table.organizationId,
      table.platformConnectionId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const accountAnalysesRelations = relations(
  accountAnalyses,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [accountAnalyses.organizationId],
      references: [organizations.id],
    }),
    platformConnection: one(platformConnections, {
      fields: [accountAnalyses.platformConnectionId],
      references: [platformConnections.id],
    }),
  }),
);
