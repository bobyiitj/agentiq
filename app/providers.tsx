"use client";
import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<"light" | "dark">("dark");

  React.useEffect(() => {
    const stored = localStorage.getItem("agentos-theme") as "light" | "dark" | null;
    const initial = stored ?? "dark";
    setTheme(initial);
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("agentos-theme", theme);
  }, [theme]);

  const toggleTheme = React.useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <SessionProvider>
      <TooltipProvider delayDuration={200}>
        <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
        <Toaster />
      </TooltipProvider>
    </SessionProvider>
  );
}

const ThemeContext = React.createContext<{ theme: string; toggleTheme: () => void }>({
  theme: "dark",
  toggleTheme: () => {},
});

export const useThemeMode = () => React.useContext(ThemeContext);
