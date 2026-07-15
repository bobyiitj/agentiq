import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "destructive" | "warning" | "info";
}) {
  const toneStyles = {
    default: { text: "text-foreground", icon: "bg-muted text-muted-foreground", border: "border-border/50" },
    success: { text: "text-emerald-600 dark:text-emerald-400", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
    destructive: { text: "text-red-600 dark:text-red-400", icon: "bg-red-500/10 text-red-600 dark:text-red-400", border: "border-red-500/20" },
    warning: { text: "text-amber-600 dark:text-amber-400", icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
    info: { text: "text-blue-600 dark:text-blue-400", icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  }[tone];

  return (
    <Card className={cn("transition-shadow hover:shadow-md", toneStyles.border)}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold tabular-nums tracking-tight", toneStyles.text)}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneStyles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
