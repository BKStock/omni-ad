import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getByCampaign,
  getByPlatform,
  getOverview,
} from "../../services/analytics.service.js";
import { computeAttribution } from "../../services/report.service.js";
import { organizationProcedure, router } from "../trpc.js";

const DateRangeInput = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const AttributionModel = z.enum([
  "markov",
  "shapley",
  "linear",
  "last_click",
  "first_click",
]);

function handleServiceError(error: unknown): never {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const analyticsRouter = router({
  overview: organizationProcedure
    .input(DateRangeInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getOverview(
          ctx.organizationId,
          input.startDate,
          input.endDate,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  byPlatform: organizationProcedure
    .input(DateRangeInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getByPlatform(
          ctx.organizationId,
          input.startDate,
          input.endDate,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  byCampaign: organizationProcedure
    .input(
      DateRangeInput.extend({
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getByCampaign(
          ctx.organizationId,
          input.startDate,
          input.endDate,
          input.limit,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  attribution: organizationProcedure
    .input(
      DateRangeInput.extend({
        model: AttributionModel.default("last_click"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await computeAttribution(
          {
            modelType: input.model,
            startDate: input.startDate,
            endDate: input.endDate,
          },
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
