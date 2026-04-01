import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const ReportType = z.enum([
  "performance",
  "budget",
  "attribution",
  "audience",
  "creative",
  "funnel",
  "executive_summary",
]);

const ExportFormat = z.enum(["pdf", "csv", "xlsx", "json"]);

export const reportsRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        type: ReportType,
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        campaignIds: z.array(z.string().uuid()).optional(),
        format: ExportFormat.default("pdf"),
        includeInsights: z.boolean().default(true),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "reports.generate is not yet implemented",
      });
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          type: ReportType.optional(),
          limit: z.number().int().min(1).max(100).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "reports.list is not yet implemented",
      });
    }),

  schedule: protectedProcedure
    .input(
      z.object({
        type: ReportType,
        frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]),
        format: ExportFormat.default("pdf"),
        recipients: z.array(z.string().email()).min(1).max(20),
        campaignIds: z.array(z.string().uuid()).optional(),
        includeInsights: z.boolean().default(true),
        timezone: z.string().default("Asia/Tokyo"),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "reports.schedule is not yet implemented",
      });
    }),

  insights: protectedProcedure
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        campaignIds: z.array(z.string().uuid()).optional(),
        focusAreas: z
          .array(
            z.enum([
              "performance_trends",
              "budget_efficiency",
              "audience_behavior",
              "creative_performance",
              "platform_comparison",
              "anomaly_detection",
            ])
          )
          .optional(),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "reports.insights is not yet implemented",
      });
    }),
});
