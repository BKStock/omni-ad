import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

const CreativeFormat = z.enum([
  "image",
  "video",
  "carousel",
  "text",
  "html5",
  "responsive",
]);

const Platform = z.enum([
  "google",
  "meta",
  "tiktok",
  "line",
  "x",
  "yahoo_japan",
]);

export const creativesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          campaignId: z.string().uuid().optional(),
          format: CreativeFormat.optional(),
          limit: z.number().int().min(1).max(100).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "creatives.list is not yet implemented",
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "creatives.get is not yet implemented",
      });
    }),

  generate: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        prompt: z.string().min(1).max(2000),
        format: CreativeFormat,
        targetPlatforms: z.array(Platform).min(1),
        brandGuidelineId: z.string().uuid().optional(),
        variations: z.number().int().min(1).max(10).default(3),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "creatives.generate is not yet implemented",
      });
    }),

  adapt: protectedProcedure
    .input(
      z.object({
        creativeId: z.string().uuid(),
        targetPlatform: Platform,
        targetFormat: CreativeFormat.optional(),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "creatives.adapt is not yet implemented",
      });
    }),
});
