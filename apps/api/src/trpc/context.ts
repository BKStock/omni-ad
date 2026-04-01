import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export interface Context {
  organizationId: string | null;
  userId: string | null;
  userRole: string | null;
}

function extractBearerPayload(
  authHeader: string | undefined
): { userId: string; organizationId: string; userRole: string } | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  // TODO: Replace with real JWT verification via @omni-ad/auth
  // For now, decode the token payload without verification for skeleton wiring.
  try {
    const parts = token.split(".");
    const payloadPart = parts[1];
    if (!payloadPart) {
      return null;
    }
    const decoded: unknown = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf-8")
    );

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "sub" in decoded &&
      "org" in decoded &&
      "role" in decoded
    ) {
      const payload = decoded as {
        sub: string;
        org: string;
        role: string;
      };
      return {
        userId: payload.sub,
        organizationId: payload.org,
        userRole: payload.role,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function createContext({
  req,
}: CreateFastifyContextOptions): Context {
  const authHeader = req.headers.authorization;
  const payload = extractBearerPayload(authHeader);

  return {
    organizationId: payload?.organizationId ?? null,
    userId: payload?.userId ?? null,
    userRole: payload?.userRole ?? null,
  };
}
