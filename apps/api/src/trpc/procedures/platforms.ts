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

export const platformsRouter = router({
  list: protectedProcedure.query(() => {
    throw new TRPCError({
      code: "METHOD_NOT_SUPPORTED",
      message: "platforms.list is not yet implemented",
    });
  }),

  connect: protectedProcedure
    .input(
      z.object({
        platform: Platform,
        redirectUrl: z.string().url(),
        scopes: z.array(z.string()).optional(),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "platforms.connect is not yet implemented",
      });
    }),

  disconnect: protectedProcedure
    .input(
      z.object({
        platform: Platform,
        accountId: z.string().min(1),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "platforms.disconnect is not yet implemented",
      });
    }),

  status: protectedProcedure
    .input(
      z.object({
        platform: Platform,
        accountId: z.string().min(1).optional(),
      })
    )
    .query(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "platforms.status is not yet implemented",
      });
    }),

  syncNow: protectedProcedure
    .input(
      z.object({
        platform: Platform,
        accountId: z.string().min(1),
        syncType: z
          .enum(["full", "incremental", "campaigns_only", "metrics_only"])
          .default("incremental"),
      })
    )
    .mutation(({ input: _input }) => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message: "platforms.syncNow is not yet implemented",
      });
    }),
});
