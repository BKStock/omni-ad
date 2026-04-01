import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const Platform = z.enum([
  "google",
  "meta",
  "tiktok",
  "line",
  "x",
  "yahoo_japan",
]);

export const budgetsRouter = router({
  current: protectedProcedure
    .input(
      z
        .object({
          campaignId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "budgets.current is not yet implemented",
      });
    }),

  history: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid().optional(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        granularity: z.enum(["hourly", "daily", "weekly", "monthly"]).default("daily"),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "budgets.history is not yet implemented",
      });
    }),

  optimize: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        objective: z.enum(["maximize_roas", "minimize_cpa", "maximize_reach"]),
        constraints: z
          .object({
            maxBudget: z.number().positive().optional(),
            minSpendPerPlatform: z.number().nonnegative().optional(),
            platformWeights: z.record(Platform, z.number().min(0).max(1)).optional(),
          })
          .optional(),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "budgets.optimize is not yet implemented",
      });
    }),

  forecast: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        budget: z.number().positive(),
        durationDays: z.number().int().min(1).max(365),
        platforms: z.array(Platform).min(1),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "budgets.forecast is not yet implemented",
      });
    }),

  simulate: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        scenarios: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              budgetChange: z.number(),
              platformAllocation: z.record(Platform, z.number().min(0).max(1)).optional(),
            })
          )
          .min(1)
          .max(5),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "budgets.simulate is not yet implemented",
      });
    }),
});
