import { router } from "./trpc.js";
import { analyticsRouter } from "./procedures/analytics.js";
import { audiencesRouter } from "./procedures/audiences.js";
import { budgetsRouter } from "./procedures/budgets.js";
import { campaignsRouter } from "./procedures/campaigns.js";
import { creativesRouter } from "./procedures/creatives.js";
import { funnelsRouter } from "./procedures/funnels.js";
import { platformsRouter } from "./procedures/platforms.js";
import { reportsRouter } from "./procedures/reports.js";

export const appRouter = router({
  campaigns: campaignsRouter,
  creatives: creativesRouter,
  analytics: analyticsRouter,
  budgets: budgetsRouter,
  audiences: audiencesRouter,
  funnels: funnelsRouter,
  reports: reportsRouter,
  platforms: platformsRouter,
});

export type AppRouter = typeof appRouter;
