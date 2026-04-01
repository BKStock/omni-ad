import { relations, sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { platformEnum, platformStatusEnum } from './enums';
import { organizations } from './organizations';

export const platformConnections = pgTable(
  'platform_connections',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', {
      withTimezone: true,
    }).notNull(),
    platformAccountId: text('platform_account_id').notNull(),
    platformAccountName: text('platform_account_name').notNull(),
    status: platformStatusEnum('status').notNull().default('active'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex('platform_connections_org_platform_account_idx').on(
      table.organizationId,
      table.platform,
      table.platformAccountId,
    ),
  ],
);

export const platformConnectionsRelations = relations(
  platformConnections,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [platformConnections.organizationId],
      references: [organizations.id],
    }),
  }),
);
