import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const CampaignStatus = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);

const CreateCampaignInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  objective: z.enum([
    "awareness",
    "traffic",
    "engagement",
    "leads",
    "conversions",
    "revenue",
  ]),
  budget: z.object({
    total: z.number().positive(),
    currency: z.string().length(3),
    dailyLimit: z.number().positive().optional(),
  }),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  targetPlatforms: z
    .array(z.enum(["google", "meta", "tiktok", "line", "x", "yahoo_japan"]))
    .min(1),
});

const UpdateCampaignInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  budget: z
    .object({
      total: z.number().positive().optional(),
      dailyLimit: z.number().positive().optional(),
    })
    .optional(),
  endDate: z.string().datetime().optional(),
  status: CampaignStatus.optional(),
});

const DeployCampaignInput = z.object({
  id: z.string().uuid(),
  platforms: z
    .array(z.enum(["google", "meta", "tiktok", "line", "x", "yahoo_japan"]))
    .min(1),
});

export const campaignsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: CampaignStatus.optional(),
          limit: z.number().int().min(1).max(100).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.list is not yet implemented",
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.get is not yet implemented",
      });
    }),

  create: protectedProcedure
    .input(CreateCampaignInput)
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.create is not yet implemented",
      });
    }),

  update: protectedProcedure
    .input(UpdateCampaignInput)
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.update is not yet implemented",
      });
    }),

  deploy: protectedProcedure
    .input(DeployCampaignInput)
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.deploy is not yet implemented",
      });
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.pause is not yet implemented",
      });
    }),

  resume: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "campaigns.resume is not yet implemented",
      });
    }),
});
