import { redirect } from "next/navigation";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";

export default async function DashboardIndex() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Stale session: user was deleted from DB but cookie still exists.
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "asc" },
  });

  if (!member) {
    // Auto-create a default workspace so the user always lands somewhere.
    const base = slugify(`${session.user.name ?? "workspace"}`) || "workspace";
    let slug = base;
    let n = 1;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    const workspace = await prisma.workspace.create({
      data: {
        name: `${session.user.name ?? "My"} Workspace`,
        slug,
        ownerId: session.user.id,
        members: { create: { userId: session.user.id, role: "OWNER" } },
      },
    });
    redirect(`/w/${workspace.id}`);
  }

  redirect(`/w/${member.workspaceId}`);
}
