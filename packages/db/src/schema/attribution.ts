import { relations, sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns';
import {
  attributionModelEnum,
  platformEnum,
  touchpointTypeEnum,
} from './enums';
import { organizations } from './organizations';

export const attributionTouchpoints = pgTable('attribution_touchpoints', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  visitorId: text('visitor_id').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  platform: platformEnum('platform').notNull(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  touchpointType: touchpointTypeEnum('touchpoint_type').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
});

export const attributionResults = pgTable('attribution_results', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  modelType: attributionModelEnum('model_type').notNull(),
  period: jsonb('period').notNull(),
  channelCredits: jsonb('channel_credits').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
});

// Relations

export const attributionTouchpointsRelations = relations(
  attributionTouchpoints,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [attributionTouchpoints.organizationId],
      references: [organizations.id],
    }),
    campaign: one(campaigns, {
      fields: [attributionTouchpoints.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const attributionResultsRelations = relations(
  attributionResults,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [attributionResults.organizationId],
      references: [organizations.id],
    }),
  }),
);
