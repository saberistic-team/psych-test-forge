import { Link, useRouter } from "@tanstack/react-router";
import {
  FlaskConical,
  LayoutDashboard,
  Sparkles,
  Library,
  BarChart3,
  CreditCard,
  Shield,
  LogOut,
  Globe,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/generate", label: "Generate", icon: Sparkles },
  { to: "/tests", label: "Test library", icon: Library },
  { to: "/analytics", label: "Results", icon: BarChart3 },
  { to: "/explore", label: "Explore", icon: Globe },
  { to: "/billing", label: "Billing", icon: CreditCard },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  isAdmin,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  isAdmin?: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-0 lg:flex-row">
        <aside className="border-b border-border bg-sidebar px-4 py-4 lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0 lg:px-5 lg:py-7">
          <Link to="/" className="flex items-center gap-2 text-sidebar-foreground">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FlaskConical className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Psych Lab</span>
          </Link>
          <nav className="mt-6 flex flex-wrap gap-1 lg:flex-col">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                to="/admin"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Shield className="size-4" />
                Admin console
              </Link>
            ) : null}
          </nav>
          <div className="mt-6 lg:absolute lg:bottom-6">
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              <LogOut className="size-4" /> Sign out
            </Button>
            <div className="mt-3 flex flex-wrap gap-3 px-3 text-xs text-muted-foreground">
              <Link to="/legal/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link to="/legal/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link to="/legal/refunds" className="hover:text-foreground">
                Refunds
              </Link>
              <Link to="/legal/acceptable-use" className="hover:text-foreground">
                AI use
              </Link>
            </div>
          </div>

        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
