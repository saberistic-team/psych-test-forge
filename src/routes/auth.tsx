import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Creator sign in — Psych Lab" },
      { name: "description", content: "Sign in or create a Psych Lab creator account to generate and publish tests." },
      { property: "og:title", content: "Creator sign in — Psych Lab" },
      { property: "og:description", content: "Sign in to generate, publish and measure psychological tests." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"password" | "forgot">("password");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void router.navigate({ to: "/dashboard" });
    });
  }, [router]);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error("Enter your email first."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reset link sent. Check your inbox.");
    setMode("password");
  }


  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await router.navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created. Check your inbox if confirmation is required.");
    const { data } = await supabase.auth.getSession();
    if (data.session) await router.navigate({ to: "/dashboard" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Google sign-in failed. Please try again."); return; }
    if (result.redirected) return;
    await router.navigate({ to: "/dashboard" });
  }

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
          <h1 className="mb-6 text-center font-display text-2xl font-semibold">Creator sign in</h1>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form className="space-y-4" onSubmit={signIn}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form className="space-y-4" onSubmit={signUp}>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create creator account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Taking a test instead? <Link to="/take" className="underline">Enter your join code</Link>
        </p>
      </div>
    </div>
  );
}
