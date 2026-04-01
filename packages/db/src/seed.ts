/**
 * Seed script for OMNI-AD development database.
 * Run: DATABASE_URL=... npx tsx packages/db/src/seed.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import {
  organizations,
  users,
  platformConnections,
  campaigns,
  campaignPlatformDeployments,
  creatives,
  creativeVariants,
  metricsDaily,
  audiences,
  funnels,
  budgetAllocations,
} from './schema/index.js';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function seed(): Promise<void> {
  console.log('Seeding OMNI-AD database...');

  // Organization
  const orgId = randomUUID();
  await db.insert(organizations).values({
    id: orgId,
    name: 'デモ株式会社',
    plan: 'pro',
    billingEmail: 'demo@omni-ad.jp',
  });
  console.log('  Organization created');

  // Users
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    organizationId: orgId,
    email: 'admin@omni-ad.jp',
    name: '田中 太郎',
    role: 'owner',
    passwordHash: '$2b$10$placeholder-hash-for-demo-only',
  });
  console.log('  User created');

  // Platform Connections (simulated)
  const platforms = ['meta', 'google', 'tiktok', 'line_yahoo'] as const;
  for (const platform of platforms) {
    await db.insert(platformConnections).values({
      organizationId: orgId,
      platform,
      accessTokenEncrypted: 'encrypted-demo-token',
      refreshTokenEncrypted: 'encrypted-demo-refresh',
      tokenExpiresAt: new Date(Date.now() + 30 * 86_400_000),
      platformAccountId: `demo-${platform}-001`,
      platformAccountName: `デモアカウント (${platform})`,
      status: 'active',
    });
  }
  console.log('  Platform connections created');

  // Campaigns
  const campaignData = [
    { name: 'AI廃業物件リスト - 認知拡大', objective: 'awareness' as const, status: 'active' as const, budget: '100000', daily: '5000' },
    { name: '衛星画像検索 - リード獲得', objective: 'leads' as const, status: 'active' as const, budget: '200000', daily: '10000' },
    { name: '無料ウェビナー集客', objective: 'conversion' as const, status: 'active' as const, budget: '150000', daily: '7500' },
    { name: '春の新生活キャンペーン', objective: 'traffic' as const, status: 'paused' as const, budget: '80000', daily: '4000' },
    { name: 'リマーケティング - カート放棄', objective: 'retargeting' as const, status: 'active' as const, budget: '50000', daily: '2500' },
  ];

  const campaignIds: string[] = [];
  for (const c of campaignData) {
    const id = randomUUID();
    campaignIds.push(id);
    await db.insert(campaigns).values({
      id,
      organizationId: orgId,
      name: c.name,
      objective: c.objective,
      status: c.status,
      startDate: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10),
      totalBudget: c.budget,
      dailyBudget: c.daily,
      createdBy: userId,
    });
  }
  console.log('  Campaigns created');

  // Platform Deployments
  const deployPlatforms = ['meta', 'google', 'tiktok', 'line_yahoo'] as const;
  for (const campaignId of campaignIds) {
    for (const platform of deployPlatforms.slice(0, 2 + Math.floor(Math.random() * 3))) {
      await db.insert(campaignPlatformDeployments).values({
        campaignId,
        platform,
        externalCampaignId: `ext-${platform}-${randomUUID().slice(0, 8)}`,
        platformStatus: 'active',
        platformBudget: (2000 + Math.floor(Math.random() * 8000)).toString(),
      });
    }
  }
  console.log('  Platform deployments created');

  // Creatives
  const creativeIds: string[] = [];
  const creativeData = [
    { type: 'image' as const, headline: '衛星が見つけた激安物件、毎月100件', body: '元銀行員が教える、誰も知らないお宝物件の見つけ方。AIが衛星画像から自動検出。' },
    { type: 'video' as const, headline: 'たった15秒で分かる！AI不動産投資', body: '衛星画像×AI技術で毎月100件の激安物件を自動配信。月額29,800円。' },
    { type: 'text' as const, headline: '激安物件 | 衛星AI検索 | 毎月100件配信', body: '元銀行員監修。衛星画像から廃業物件を自動検出。投資家必見の新サービス。' },
    { type: 'carousel' as const, headline: 'Before/After: AI物件リストの成功事例', body: '導入企業の平均ROI 320%達成。3ヶ月で投資回収。' },
  ];

  for (const c of creativeData) {
    const id = randomUUID();
    creativeIds.push(id);
    await db.insert(creatives).values({
      id,
      organizationId: orgId,
      type: c.type,
      baseContent: { headline: c.headline, body: c.body, cta: '詳細を見る', imageUrl: null, videoUrl: null, thumbnailUrl: null },
      aiGenerated: true,
      promptUsed: 'AI廃業物件リスト広告',
      modelUsed: 'claude-opus-4-5',
      performanceScore: Math.random() * 0.6 + 0.4,
    });

    // Variants per platform
    for (const platform of ['meta', 'google', 'tiktok'] as const) {
      await db.insert(creativeVariants).values({
        creativeId: id,
        platform,
        adaptedContent: { headline: c.headline, body: c.body, cta: '詳細を見る', imageUrl: null, videoUrl: null, thumbnailUrl: null },
        width: platform === 'tiktok' ? 1080 : 1200,
        height: platform === 'tiktok' ? 1920 : 628,
        format: c.type === 'video' ? 'mp4' : 'jpg',
      });
    }
  }
  console.log('  Creatives created');

  // Metrics (14 days of daily data)
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date(Date.now() - dayOffset * 86_400_000).toISOString().slice(0, 10);

    for (const campaignId of campaignIds) {
      for (const platform of ['meta', 'google'] as const) {
        const impressions = 5000 + Math.floor(Math.random() * 15000);
        const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.04));
        const conversions = Math.floor(clicks * (0.02 + Math.random() * 0.08));
        const spend = (1000 + Math.random() * 4000).toFixed(2);
        const revenue = (Number(spend) * (1.5 + Math.random() * 4)).toFixed(2);
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const cpc = clicks > 0 ? Number(spend) / clicks : 0;
        const cpa = conversions > 0 ? Number(spend) / conversions : 0;
        const roas = Number(spend) > 0 ? Number(revenue) / Number(spend) : 0;

        await db.insert(metricsDaily).values({
          date,
          campaignId,
          platform,
          impressions,
          clicks,
          conversions,
          spend,
          revenue,
          ctr,
          cpc,
          cpa,
          roas,
        });
      }
    }
  }
  console.log('  14 days of metrics created');

  // Audiences
  for (const platform of ['meta', 'google', 'line_yahoo'] as const) {
    await db.insert(audiences).values({
      organizationId: orgId,
      name: `不動産投資家 (${platform})`,
      platform,
      size: 50000 + Math.floor(Math.random() * 200000),
      segmentDefinition: {
        type: 'saved',
        source: null,
        rules: [
          { field: 'interest', operator: 'contains', value: '不動産投資' },
          { field: 'age', operator: 'gt', value: 25 },
          { field: 'age', operator: 'lt', value: 55 },
        ],
      },
    });
  }
  console.log('  Audiences created');

  // Funnels
  await db.insert(funnels).values({
    organizationId: orgId,
    name: 'AI物件リスト 獲得ファネル',
    stages: [
      { name: '認知', objective: 'awareness', platforms: ['tiktok', 'meta'], campaignIds: [campaignIds[0]] },
      { name: '興味喚起', objective: 'traffic', platforms: ['meta', 'google'], campaignIds: [campaignIds[1]] },
      { name: 'クロージング', objective: 'conversion', platforms: ['google', 'line_yahoo'], campaignIds: [campaignIds[2]] },
      { name: '追客', objective: 'retargeting', platforms: ['meta', 'line_yahoo'], campaignIds: [campaignIds[4]] },
    ],
    status: 'active',
    createdBy: userId,
  });
  console.log('  Funnel created');

  // Budget Allocations (7 days)
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date(Date.now() - dayOffset * 86_400_000).toISOString().slice(0, 10);
    await db.insert(budgetAllocations).values({
      organizationId: orgId,
      date,
      totalBudget: '100000',
      allocations: {
        meta: 30000 + Math.floor(Math.random() * 5000),
        google: 35000 + Math.floor(Math.random() * 5000),
        tiktok: 20000 + Math.floor(Math.random() * 5000),
        line_yahoo: 15000 + Math.floor(Math.random() * 3000),
      },
      predictedRoas: 2.5 + Math.random() * 2,
      actualRoas: 2.0 + Math.random() * 3,
      algorithmVersion: 'thompson-sampling-v1',
    });
  }
  console.log('  Budget allocations created');

  console.log('\nSeed complete!');
  console.log(`  Organization: ${orgId}`);
  console.log(`  User: admin@omni-ad.jp (owner)`);
  console.log(`  Campaigns: ${campaignIds.length}`);
  console.log(`  Creatives: ${creativeIds.length}`);
  console.log(`  Metrics: 14 days x ${campaignIds.length} campaigns x 2 platforms`);

  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
