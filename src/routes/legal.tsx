import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: LegalLayout,
});

function LegalLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 text-sm">
          <Link to="/" className="font-heading text-base font-semibold">
            Psych Lab
          </Link>
          <nav className="flex gap-4 text-muted-foreground">
            <Link to="/legal/terms" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Terms
            </Link>
            <Link to="/legal/privacy" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Privacy
            </Link>
            <Link to="/legal/refunds" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Refunds
            </Link>
            <Link
              to="/legal/acceptable-use"
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              AI use
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 [&_a]:underline [&_h2]:font-heading [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mb-1 [&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-sm [&_ul]:text-muted-foreground">
        <Outlet />
      </main>
      <footer className="border-t border-border/60 px-5 py-8 text-center text-xs text-muted-foreground">
        Psych Lab — research and self-reflection tools. Not a diagnostic, medical or professional-advice service, and
        never used to make or influence decisions about a person.
      </footer>
    </div>
  );
}
