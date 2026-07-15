import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceModels } from "@/features/providers/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const models = await getWorkspaceModels(params.workspaceId);
  return NextResponse.json(models);
}
