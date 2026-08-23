import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Globe, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { getListingSlots, listOnMarketplace, unlistFromMarketplace } from "@/lib/marketplace.functions";
import { setListingPrice } from "@/lib/listings.functions";
import { LISTING_PRICE_MAX_CENTS, LISTING_PRICE_MIN_CENTS, centsToUsd } from "@/lib/plans";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TestRow = {
  id: string;
  published: boolean;
  listed: boolean;
  featured: boolean;
  verified: boolean;
  tagline: string | null;
  listing_description: string | null;
  price_cents: number;
  sale_mode: string;
};

/** Creator controls for publishing a test to the public Explore marketplace. */
export function MarketplacePanel({ test }: { test: TestRow }) {
  const qc = useQueryClient();
  const slots = useQuery({ queryKey: ["listing-slots"], queryFn: useServerFn(getListingSlots) });
  const list = useServerFn(listOnMarketplace);
  const unlist = useServerFn(unlistFromMarketplace);
  const [tagline, setTagline] = useState(test.tagline ?? "");
  const [description, setDescription] = useState(test.listing_description ?? "");
  const [saleMode, setSaleMode] = useState<"free" | "take" | "results">(
    (test.sale_mode as "free" | "take" | "results") ?? "free",
  );
  const [price, setPrice] = useState(test.price_cents ? (test.price_cents / 100).toFixed(2) : "9.00");

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["test", test.id] });
    await qc.invalidateQueries({ queryKey: ["listing-slots"] });
    await qc.invalidateQueries({ queryKey: ["my-tests"] });
  };

  const listMutation = useMutation({
    mutationFn: () => list({ data: { testId: test.id, tagline, description } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      toast.success("Listed on the marketplace.");
      await invalidate();
    },
    onError: () => toast.error("Add a tagline (8+ chars) and a description (30+ chars)."),
  });

  const savePrice = useServerFn(setListingPrice);
  const priceMutation = useMutation({
    mutationFn: () =>
      savePrice({
        data: {
          testId: test.id,
          saleMode,
          priceCents: saleMode === "free" ? 0 : Math.round(Number(price) * 100),
        },
      }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      toast.success(saleMode === "free" ? "This listing is now free." : "Price saved.");
      await invalidate();
    },
    onError: () => toast.error("Could not save the price."),
  });

  const unlistMutation = useMutation({
    mutationFn: () => unlist({ data: { testId: test.id } }),
    onSuccess: async () => {
      toast.success("Removed from the marketplace.");
      await invalidate();
    },
    onError: () => toast.error("Could not unlist the test."),
  });

  // `limit === null` means unlimited (Business) — never treat it as zero.
  const limit = slots.data ? slots.data.limit : undefined;
  const locked = limit === 0;
  const outOfSlots = Boolean(
    slots.data && !test.listed && slots.data.remaining !== null && slots.data.remaining <= 0,
  );

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Public marketplace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {test.listed
              ? "This test is live on Explore and can be found by anyone."
              : "Listing makes this test discoverable on the public Explore page."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={test.listed ? "default" : "secondary"}>{test.listed ? "Listed" : "Not listed"}</Badge>
            {test.featured ? (
              <Badge className="gap-1">
                <Star className="size-3" /> Featured
              </Badge>
            ) : null}
            {test.verified ? (
              <Badge variant="outline" className="gap-1">
                <BadgeCheck className="size-3" /> Verified
              </Badge>
            ) : null}
            {slots.data ? (
              <span className="text-xs text-muted-foreground">
                {slots.data.planName} plan · {slots.data.used} of{" "}
                {slots.data.limit === null ? "unlimited" : slots.data.limit} listings used
              </span>
            ) : null}
          </div>
        </div>
        {test.listed ? (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/explore">
                <Globe className="size-4" /> View on Explore
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => unlistMutation.mutate()} disabled={unlistMutation.isPending}>
              Unlist
            </Button>
          </div>
        ) : null}
      </div>


      {test.published ? (
        <div className="surface space-y-4 p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Charge for this questionnaire</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Psych Lab handles the payment and sends you your share each month. Your current price:{" "}
              <span className="font-medium">
                {test.sale_mode === "free" || !test.price_cents ? "free" : centsToUsd(test.price_cents)}
              </span>
              .
            </p>
          </div>
          {!slots.data?.canPriceListings ? (
            <div className="text-sm text-muted-foreground">
              Selling questionnaires is a Business plan feature.
              <Button asChild size="sm" variant="outline" className="ml-3">
                <Link to="/billing">See plans</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sale-mode">What people pay for</Label>
                  <Select value={saleMode} onValueChange={(v) => setSaleMode(v as typeof saleMode)}>
                    <SelectTrigger id="sale-mode" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free — no payment</SelectItem>
                      <SelectItem value="take">Pay to answer the questionnaire</SelectItem>
                      <SelectItem value="results">Free to answer, pay for the full results</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="listing-price">Price (USD)</Label>
                  <Input
                    id="listing-price"
                    className="mt-1.5"
                    inputMode="decimal"
                    disabled={saleMode === "free"}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Between {centsToUsd(LISTING_PRICE_MIN_CENTS)} and {centsToUsd(LISTING_PRICE_MAX_CENTS)}.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => priceMutation.mutate()}
                disabled={
                  priceMutation.isPending ||
                  (saleMode !== "free" && Math.round(Number(price) * 100) < LISTING_PRICE_MIN_CENTS)
                }
              >
                {priceMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save pricing
              </Button>
              <p className="text-xs text-muted-foreground">
                Earnings, the platform fee and monthly settlements are shown on your{" "}
                <Link to="/earnings" className="underline">
                  Earnings page
                </Link>
                .
              </p>
            </>
          )}
        </div>
      ) : null}

      {!test.published ? (
        <div className="surface p-5 text-sm text-muted-foreground">
          Publish the test first — listings point participants at its join code.
        </div>
      ) : locked ? (
        <div className="surface p-5">
          <p className="text-sm text-muted-foreground">
            Marketplace listings are a paid feature. Pro includes 3 public listings, Business includes unlimited
            listings and eligibility for featuring.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/billing">See plans</Link>
          </Button>
        </div>
      ) : (
        <div className="surface space-y-4 p-5">
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              maxLength={90}
              placeholder="A 12-minute look at how you recover from setbacks"
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">{tagline.length}/90</p>
          </div>
          <div>
            <Label htmlFor="listing-description">Listing description</Label>
            <Textarea
              id="listing-description"
              value={description}
              maxLength={600}
              rows={4}
              placeholder="Who the instrument is for, what it measures, and what the participant gets back."
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">{description.length}/600</p>
          </div>
          {outOfSlots ? (
            <p className="text-sm text-destructive">
              Every listing slot on your plan is in use. Unlist another test or upgrade for more.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => listMutation.mutate()}
              disabled={listMutation.isPending || tagline.trim().length < 8 || description.trim().length < 30 || outOfSlots}
            >
              {listMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
              {test.listed ? "Update listing" : "List on marketplace"}
            </Button>
            {slots.data?.canRequestFeatured ? (
              <span className="text-xs text-muted-foreground">
                Business listings are eligible for featuring by the Psych Lab review team.
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
