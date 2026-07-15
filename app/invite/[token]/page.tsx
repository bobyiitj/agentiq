"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [accepting, setAccepting] = React.useState(false);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/invite/${params.token}`);
    }
  }, [status, params.token, router]);

  async function accept() {
    setAccepting(true);
    const res = await fetch(`/api/invite/${params.token}`, { method: "POST" });
    if (res.ok) {
      const { workspaceId } = await res.json();
      toast.success("You've joined the workspace");
      router.push(`/w/${workspaceId}`);
    } else {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      toast.error(err.error ?? "Failed to accept");
      setAccepting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Workspace Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            {status === "loading" ? "Loading…" : `You've been invited to join a workspace as a member.`}
          </p>
          <Button className="w-full" onClick={accept} disabled={accepting || status !== "authenticated"}>
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & Join"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
