import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/features/audit/logger";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitation = await prisma.invitation.findUnique({ where: { token: params.token } });
  if (!invitation) return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  if (invitation.acceptedAt) return NextResponse.json({ error: "Already accepted" }, { status: 409 });
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.email !== invitation.email) {
    return NextResponse.json({ error: "This invite is for a different account email." }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId: session.user.id, role: invitation.role },
    }),
    prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ]);

  await logActivity({
    workspaceId: invitation.workspaceId,
    userId: session.user.id,
    action: "member.joined",
    resource: "members",
    metadata: { email: invitation.email, role: invitation.role },
  });

  return NextResponse.json({ workspaceId: invitation.workspaceId });
}
