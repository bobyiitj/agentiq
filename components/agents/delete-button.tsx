"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function DeleteAgentButton({ workspaceId, agentId }: { workspaceId: string; agentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function remove() {
    setLoading(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      toast.success("Agent archived");
      setOpen(false);
      router.push(`/w/${workspaceId}/agents`);
      router.refresh();
    } else {
      toast.error("Failed to archive");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Trash2 className="h-4 w-4" /> Archive</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive agent?</DialogTitle>
          <DialogDescription>This hides the agent from listings. Run history is preserved.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button variant="destructive" onClick={remove} disabled={loading}>{loading ? "Archiving..." : "Archive"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
