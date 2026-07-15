import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Construction className="mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">{title} arrives in Phase 2</p>
          <p className="mt-1 max-w-md text-sm">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
