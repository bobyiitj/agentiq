import { prisma } from "@/lib/db/prisma";
import type { MemberRole } from "@prisma/client";

export async function logActivity(params: {
  workspaceId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        metadata: params.metadata as object,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    // Never let audit logging break the main flow.
    console.error("audit log failed", err);
  }
}

export function getClientMeta(req?: Request): { ipAddress: string | undefined; userAgent: string | undefined } {
  if (!req) return { ipAddress: undefined, userAgent: undefined };
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

export type { MemberRole };
