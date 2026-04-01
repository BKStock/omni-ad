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

export const audiencesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          platform: Platform.optional(),
          limit: z.number().int().min(1).max(100).default(20),
          cursor: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "audiences.list is not yet implemented",
      });
    }),

  overlaps: protectedProcedure
    .input(
      z.object({
        audienceIds: z.array(z.string().uuid()).min(2).max(5),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "audiences.overlaps is not yet implemented",
      });
    }),

  sync: protectedProcedure
    .input(
      z.object({
        audienceId: z.string().uuid(),
        targetPlatform: Platform,
        mappingConfig: z
          .object({
            matchType: z.enum(["email", "phone", "device_id", "custom"]).default("email"),
            consentVerified: z.boolean(),
          })
          .optional(),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "audiences.sync is not yet implemented",
      });
    }),
});
