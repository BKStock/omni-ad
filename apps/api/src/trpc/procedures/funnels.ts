import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const FunnelStageType = z.enum([
  "awareness",
  "interest",
  "consideration",
  "intent",
  "conversion",
  "retention",
]);

const Platform = z.enum([
  "google",
  "meta",
  "tiktok",
  "line",
  "x",
  "yahoo_japan",
]);

export const funnelsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "funnels.list is not yet implemented",
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "funnels.get is not yet implemented",
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        stages: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              type: FunnelStageType,
              platforms: z.array(Platform).min(1),
              campaignIds: z.array(z.string().uuid()).optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "funnels.create is not yet implemented",
      });
    }),

  autoConstruct: protectedProcedure
    .input(
      z.object({
        objective: z.enum([
          "lead_generation",
          "ecommerce_sales",
          "app_installs",
          "brand_awareness",
          "saas_trial",
        ]),
        budget: z.number().positive(),
        targetPlatforms: z.array(Platform).min(1),
        industryVertical: z.string().min(1).max(100).optional(),
        existingCampaignIds: z.array(z.string().uuid()).optional(),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "funnels.autoConstruct is not yet implemented",
      });
    }),
});
