import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock, FlaskConical, History, Loader2, Search, Star, Users } from "lucide-react";
import { browseMarketplace, recordListingEvent, type MarketplaceListing } from "@/lib/marketplace.functions";
import { visualsSchema, type TestVisuals } from "@/lib/spec";
import { TestBanner } from "@/components/visuals/TestBanner";
import { TestIcon } from "@/components/visuals/TestIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore self-reflection questionnaires — Psych Lab" },
      {
        name: "description",
        content:
          "Browse public self-report questionnaires published by Psych Lab creators: personality, resilience, motivation and more — free to take in minutes, for curiosity and self-reflection.",
      },
      { property: "og:title", content: "Explore self-reflection questionnaires — Psych Lab" },
      {
        property: "og:description",
        content:
          "Public self-report questionnaires you can answer right now, with your own arithmetic scores shown back to you.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

const FALLBACK_VISUALS: TestVisuals = {
  icon: { type: "emoji", value: "🧠", style: "" },
  banner: { gradient: ["#101828", "#1D4ED8"], pattern: "grid", accent: "#60A5FA", caption: "" },
  results: { style: "bars", theme: "", description: "" },
};

function visualsFor(listing: MarketplaceListing): TestVisuals {
  const parsed = visualsSchema.safeParse(listing.visuals);
  return parsed.success ? parsed.data : FALLBACK_VISUALS;
}

function ExplorePage() {
  const browse = useServerFn(browseMarketplace);
  const track = useServerFn(recordListingEvent);
  const [search, setSearch] = useState("");
  const [construct, setConstruct] = useState("all");
  const [sort, setSort] = useState<"featured" | "newest" | "popular" | "shortest">("featured");

  const query = useQuery({
    queryKey: ["marketplace", search, construct, sort],
    queryFn: () => browse({ data: { search, construct, sort } }),
  });

  const listings = query.data?.listings ?? [];
  const hero = sort === "featured" && !search && construct === "all" ? (query.data?.hero ?? null) : null;
  const rest = useMemo(() => listings.filter((l) => l.id !== hero?.id), [listings, hero]);

  // One impression per listing per browser session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const l of listings.slice(0, 24)) {
      const key = `pl-impr-${l.id}`;
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
      void track({ data: { testId: l.id, kind: "impression" } }).catch(() => undefined);
    }
  }, [listings, track]);

  const onJoin = (id: string) => void track({ data: { testId: id, kind: "join" } }).catch(() => undefined);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="size-4" />
            </span>
            <span className="font-display font-semibold">Psych Lab</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/history">
                <History className="size-4" /> My results
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/take">Have a code?</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Explore public questionnaires</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Self-report questionnaires published by Psych Lab creators. Your answers are added up arithmetically and the
          score range text the creator wrote in advance is shown back to you — for curiosity and self-reflection, not
          diagnosis, screening or advice.
        </p>


        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search constructs, subscales or frameworks"
              className="pl-9"
              aria-label="Search tests"
            />
          </div>
          <Select value={construct} onValueChange={setConstruct}>
            <SelectTrigger className="w-[210px]" aria-label="Filter by construct">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All constructs</SelectItem>
              {(query.data?.constructs ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-[180px]" aria-label="Sort listings">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured first</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Most taken</SelectItem>
              <SelectItem value="shortest">Quickest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="mt-10 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading listings…
          </div>
        ) : !listings.length ? (
          <div className="surface mt-10 p-10 text-center">
            <h2 className="font-display text-xl font-semibold">Nothing listed yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              No public tests match this view. Creators on a paid plan can list their published tests here.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth">Create a test</Link>
            </Button>
          </div>
        ) : (
          <>
            {hero ? (
              <section className="mt-10">
                <div className="surface overflow-hidden">
                  <TestBanner
                    visuals={visualsFor(hero)}
                    title={hero.title}
                    subtitle={hero.tagline ?? undefined}
                    height={220}
                    className="rounded-none"
                  />
                  <div className="flex flex-wrap items-end justify-between gap-5 p-6">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="gap-1">
                          <Star className="size-3" /> Featured
                        </Badge>
                        {hero.verified ? (
                          <Badge variant="outline" className="gap-1">
                            <BadgeCheck className="size-3" /> Verified
                          </Badge>
                        ) : null}
                        <Badge variant="secondary">{hero.construct}</Badge>
                        {hero.saleMode !== "free" && hero.priceCents > 0 ? (
                          <Badge variant="outline">
                            ${(hero.priceCents / 100).toFixed(2)}{" "}
                            {hero.saleMode === "take" ? "to answer" : "for full results"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Free</Badge>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {hero.description ?? hero.framework}
                      </p>
                      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" /> ~{hero.minutes} min · {hero.items} items
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" /> {hero.attempts} taken
                        </span>
                        <span>{hero.subscales.join(" · ")}</span>
                      </p>
                    </div>
                    {hero.accessCode ? (
                      <Button asChild size="lg" onClick={() => onJoin(hero.id)}>
                        <Link to="/take/$code" params={{ code: hero.accessCode }}>
                          Take this test
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((l) => {
                const v = visualsFor(l);
                return (
                  <article key={l.id} className="surface flex flex-col overflow-hidden">
                    <TestBanner visuals={v} height={120} showIcon={false} className="rounded-none" />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start gap-3">
                        <TestIcon visuals={v} size={40} />
                        <div className="min-w-0">
                          <h2 className="font-display leading-snug font-semibold">{l.title}</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">{l.construct}</p>
                        </div>
                      </div>
                      {l.tagline ? <p className="mt-3 text-sm text-muted-foreground">{l.tagline}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {l.verified ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <BadgeCheck className="size-3" /> Verified
                          </Badge>
                        ) : null}
                        {l.saleMode !== "free" && l.priceCents > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            ${(l.priceCents / 100).toFixed(2)} {l.saleMode === "take" ? "to answer" : "for results"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Free
                          </Badge>
                        )}
                        {l.subscales.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-4 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" /> ~{l.minutes} min
                        </span>
                        <span>{l.items} items</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" /> {l.attempts}
                        </span>
                      </p>
                      <div className="mt-5 flex-1" />
                      {l.accessCode ? (
                        <Button asChild className="w-full" onClick={() => onJoin(l.id)}>
                          <Link to="/take/$code" params={{ code: l.accessCode }}>
                            Take test
                          </Link>
                        </Button>
                      ) : null}
                      {l.creatorOrg ? (
                        <p className="mt-2 text-center text-xs text-muted-foreground">by {l.creatorOrg}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
