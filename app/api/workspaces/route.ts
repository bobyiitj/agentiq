import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";
import { logActivity } from "@/features/audit/logger";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json(members.map((m) => ({ id: m.workspace.id, name: m.workspace.name, slug: m.workspace.slug, role: m.role })));
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const base = slugify(parsed.data.name) || "workspace";
  let slug = base;
  let n = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      slug,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id, role: "OWNER" } },
    },
  });

  await logActivity({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "workspace.created",
    resource: "workspace",
    resourceId: workspace.id,
    metadata: { name: workspace.name },
  });

  return NextResponse.json(workspace, { status: 201 });
}
