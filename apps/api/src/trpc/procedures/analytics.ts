import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const DateRangeInput = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const Platform = z.enum([
  "google",
  "meta",
  "tiktok",
  "line",
  "x",
  "yahoo_japan",
]);

const AttributionModel = z.enum([
  "last_click",
  "first_click",
  "linear",
  "time_decay",
  "position_based",
  "data_driven",
]);

export const analyticsRouter = router({
  overview: protectedProcedure
    .input(DateRangeInput)
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "analytics.overview is not yet implemented",
      });
    }),

  byPlatform: protectedProcedure
    .input(
      DateRangeInput.extend({
        platforms: z.array(Platform).optional(),
        metrics: z
          .array(
            z.enum([
              "impressions",
              "clicks",
              "conversions",
              "spend",
              "ctr",
              "cpc",
              "cpa",
              "roas",
            ])
          )
          .optional(),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "analytics.byPlatform is not yet implemented",
      });
    }),

  byCampaign: protectedProcedure
    .input(
      DateRangeInput.extend({
        campaignIds: z.array(z.string().uuid()).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "analytics.byCampaign is not yet implemented",
      });
    }),

  attribution: protectedProcedure
    .input(
      DateRangeInput.extend({
        model: AttributionModel.default("last_click"),
        campaignIds: z.array(z.string().uuid()).optional(),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "analytics.attribution is not yet implemented",
      });
    }),
});
