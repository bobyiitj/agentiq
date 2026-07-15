import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { logActivity, getClientMeta } from "@/features/audit/logger";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: params.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { workspaceId: params.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  return NextResponse.json({ members, invitations });
}

export async function POST(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "members", "create"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const first = Object.values(errors)[0]?.[0] ?? "Invalid input";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  // If user already a member, reject.
  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingUser) {
    const already = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: existingUser.id } },
    });
    if (already) return NextResponse.json({ error: "Already a member" }, { status: 409 });
  }

  const token = randomBytes(24).toString("hex");
  const invitation = await prisma.invitation.create({
    data: {
      workspaceId: params.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  const meta = getClientMeta(req);
  await logActivity({
    workspaceId: params.workspaceId,
    userId: session.user.id,
    action: "member.invited",
    resource: "members",
    metadata: { email: invitation.email, role: invitation.role },
    ...meta,
  });

  return NextResponse.json({ invitation });
}
