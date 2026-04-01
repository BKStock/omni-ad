import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware that enforces an authenticated user.
 * Rejects requests where `userId` is missing from context.
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userRole: ctx.userRole ?? "member",
    },
  });
});

/**
 * Middleware that enforces an authenticated user WITH an organization context.
 * Rejects requests where `organizationId` is missing.
 */
const enforceOrganization = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization context required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userRole: ctx.userRole ?? "member",
      organizationId: ctx.organizationId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
export const organizationProcedure = t.procedure.use(enforceOrganization);
