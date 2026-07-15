import { redirect } from "next/navigation";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
    include: { workspace: true },
  });

  if (!member) {
    // User not a member — redirect to their first workspace or dashboard.
    const first = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true },
    });
    if (first) redirect(`/w/${first.workspaceId}`);
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar workspaceId={params.workspaceId} role={member.role} />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
