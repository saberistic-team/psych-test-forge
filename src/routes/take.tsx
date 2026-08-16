import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { FlaskConical, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/take")({
  head: () => ({
    meta: [
      { title: "Enter your join code — Psych Lab" },
      { name: "description", content: "Enter the six-character join code from your test invitation to begin." },
      { property: "og:title", content: "Enter your join code — Psych Lab" },
      { property: "og:description", content: "Start a Psych Lab assessment with your join code. No account needed." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="hero-wash flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FlaskConical className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Psych Lab</span>
        </Link>
        <div className="surface p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold">Join a test</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the code you were given. No account and no email required.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length >= 4) void router.navigate({ to: "/take/$code", params: { code: c } });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="code">Join code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="K7M2QP"
                className="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={code.trim().length < 4}>
              Continue
            </Button>
          </form>
        </div>
        <div className="mt-4 flex justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link to="/history">
              <History className="size-4" /> My past results
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
