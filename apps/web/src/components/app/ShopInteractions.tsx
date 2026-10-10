"use client";

import { Heart, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PendingMark } from "@/components/PendingMark";
import type { Review, ReviewPage } from "@/lib/api/shop-interactions";
import { assertShopPresent, parseReview, parseReviewPage, reviewInputSchema, ShopGoneError } from "@/lib/api/shop-interactions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { loginPath } from "@/lib/auth/return-path";
import { useTranslation } from "@/lib/i18n";
import { displayUserName } from "@/lib/user-name";

export function ShopInteractions({
  shopId,
  initialPage,
}: {
  shopId: string;
  initialPage: ReviewPage | null;
}) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { lang, t } = useTranslation();
  const [reviews, setReviews] = React.useState<Review[]>(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>(initialPage?.nextCursor);
  const [averageRating, setAverageRating] = React.useState<number | null>(initialPage?.averageRating ?? null);
  const [myReview, setMyReview] = React.useState<Review>();
  const [saved, setSaved] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [message, setMessage] = React.useState(
    initialPage ? "" : t("directory.reviews_unavailable"),
  );

  const loadReviews = React.useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/shops/${encodeURIComponent(shopId)}/reviews?${params}`);
    assertShopPresent(response);
    if (!response.ok) throw new Error("reviews");
    const page = parseReviewPage(await response.json());
    setReviews((current) => cursor ? [...current, ...page.items] : page.items);
    setNextCursor(page.nextCursor);
    setAverageRating(page.averageRating);
  }, [shopId]);

  React.useEffect(() => {
    if (isAuthLoading || !user || user.role !== "RESIDENT") return;
    void fetch(`/api/shops/${encodeURIComponent(shopId)}/save`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ data: { saved: boolean } }> : null)
      .then((result) => result && setSaved(result.data.saved))
      .catch(() => undefined);
  }, [isAuthLoading, shopId, user]);

  React.useEffect(() => {
    if (!user || user.role !== "RESIDENT") return;
    const visibleReview = reviews.find((review) => review.user.id === user.id);
    if (visibleReview || myReview) return;
    const userId = user.id;

    let active = true;
    async function findReview(cursor?: string): Promise<void> {
      if (!cursor) return;
      const response = await fetch(
        `/api/shops/${encodeURIComponent(shopId)}/reviews?cursor=${encodeURIComponent(cursor)}`,
      );
      if (!response.ok) return;
      const page = parseReviewPage(await response.json());
      const owned = page.items.find((review) => review.user.id === userId);
      if (owned && active) setMyReview(owned);
      else if (page.nextCursor && active) await findReview(page.nextCursor);
    }
    void findReview(nextCursor);
    return () => { active = false; };
  }, [myReview, nextCursor, reviews, shopId, user]);

  function failureMessage(error: unknown, fallback: "errors.server" | "directory.reviews_unavailable") {
    return t(error instanceof ShopGoneError ? "directory.shop_gone" : fallback);
  }

  const ownedReview = myReview ?? (user ? reviews.find((review) => review.user.id === user.id) : undefined);

  async function toggleSaved() {
    if (!user) return;
    const previous = saved;
    setSaved(!previous);
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/shops/${encodeURIComponent(shopId)}/save`, {
        method: previous ? "DELETE" : "POST",
      });
      assertShopPresent(response);
      if (!response.ok) throw new Error("save");
      setMessage(previous ? t("directory.shop_unsaved") : t("directory.shop_saved"));
    } catch (error) {
      setSaved(previous);
      setMessage(failureMessage(error, "errors.server"));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = reviewInputSchema.safeParse({
      rating: form.get("rating"),
      comment: form.get("comment"),
    });
    if (!input.success) {
      setMessage(t("directory.rating_required"));
      return;
    }
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/shops/${encodeURIComponent(shopId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      assertShopPresent(response);
      if (!response.ok) throw new Error("review");
      const payload = await response.json() as unknown;
      const updated = parseReview(payload);
      setMyReview(updated);
      await loadReviews();
      setMessage(ownedReview ? t("directory.review_updated") : t("directory.review_created"));
    } catch (error) {
      setMessage(failureMessage(error, "errors.server"));
    } finally {
      setIsBusy(false);
    }
  }

  async function removeReview() {
    if (!window.confirm(t("directory.delete_review_confirm"))) return;
    setIsBusy(true);
    try {
      const response = await fetch(`/api/shops/${encodeURIComponent(shopId)}/reviews`, { method: "DELETE" });
      assertShopPresent(response);
      if (!response.ok) throw new Error("delete");
      setMyReview(undefined);
      await loadReviews();
      setMessage(t("directory.review_deleted"));
    } catch (error) {
      setMessage(failureMessage(error, "errors.server"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section aria-labelledby="shop-reviews-title" className="border-t border-border py-10 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="shop-reviews-title" className="text-[length:var(--text-h2)] font-bold text-foreground">
            {t("directory.reviews_tab")}
          </h2>
          {averageRating !== null && (
            <p className="mt-2 flex items-center gap-2 text-[length:var(--text-label)] text-muted-foreground">
              <Star aria-hidden="true" className="size-4 fill-primary text-primary" />
              <strong className="text-foreground">{averageRating.toFixed(1)}</strong>
            </p>
          )}
        </div>
        {user?.role === "RESIDENT" && (
          <button
            type="button"
            onClick={toggleSaved}
            disabled={isBusy}
            aria-pressed={saved}
            className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60 motion-reduce:transition-none"
          >
            <Heart aria-hidden="true" className={`size-5 ${saved ? "fill-primary text-primary" : ""}`} />
            {saved ? t("directory.saved") : t("directory.save")}
          </button>
        )}
      </div>

      {!isAuthLoading && user?.role === "RESIDENT" ? (
        <form onSubmit={submitReview} className="mt-8 border-y border-border py-6">
          <fieldset disabled={isBusy}>
            <legend className="font-bold text-foreground">{ownedReview ? t("directory.edit_review") : t("directory.write_review")}</legend>
            <div className="mt-4 flex gap-2" dir="ltr">
              {[1, 2, 3, 4, 5].map((rating) => (
                <label key={rating} className="cursor-pointer">
                  <input className="peer sr-only" type="radio" name="rating" value={rating} defaultChecked={ownedReview?.rating === rating} required />
                  <Star className="size-8 text-muted-foreground peer-checked:fill-primary peer-checked:text-primary" aria-label={`${rating} ${t("directory.stars")}`} />
                </label>
              ))}
            </div>
            <label className="mt-5 block font-semibold text-foreground" htmlFor="review-comment">
              {t("directory.review_comment")}
            </label>
            <textarea
              id="review-comment"
              name="comment"
              key={ownedReview?.id ?? "new"}
              defaultValue={ownedReview?.comment ?? ""}
              maxLength={1000}
              rows={4}
              placeholder={t("directory.review_placeholder")}
              className="mt-2 w-full rounded-md border border-border bg-card p-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60">
                {isBusy && <PendingMark size={16} />}
                {ownedReview ? t("directory.update_review") : t("directory.submit_review")}
              </button>
              {ownedReview && (
                <button type="button" onClick={removeReview} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-error px-5 font-bold text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error">
                  <Trash2 aria-hidden="true" className="size-4" />
                  {t("common.delete")}
                </button>
              )}
            </div>
          </fieldset>
        </form>
      ) : !isAuthLoading && !user ? (
        <p className="mt-8 border-y border-border py-6 text-muted-foreground">
          <Link href={loginPath(`/directory/${encodeURIComponent(shopId)}`)} className="font-bold text-primary underline-offset-4 hover:underline">
            {t("auth.login")}
          </Link>{" "}{t("directory.login_to_review")}
        </p>
      ) : null}

      <p aria-live="polite" className="mt-4 min-h-6 text-[length:var(--text-label)] text-muted-foreground">{message}</p>

      {reviews.length === 0 ? (
        <p className="py-8 text-muted-foreground">{t("directory.no_reviews")}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {reviews.map((review) => (
            <li key={review.id} className="py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="text-foreground">{displayUserName(review.user.name, t("common.deleted_user"))}</strong>
                <time dateTime={review.createdAt} className="text-[length:var(--text-caption)] text-muted-foreground">
                  {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(review.createdAt))}
                </time>
              </div>
              <div className="mt-2 flex gap-1" aria-label={`${review.rating} ${t("directory.stars")}`} dir="ltr">
                {[1, 2, 3, 4, 5].map((star) => <Star key={star} aria-hidden="true" className={`size-4 ${star <= review.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />)}
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-line leading-7 text-foreground">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <button type="button" disabled={isBusy} onClick={() => void loadReviews(nextCursor).catch((error) => setMessage(failureMessage(error, "directory.reviews_unavailable")))} className="mt-6 min-h-12 rounded-md border border-border px-5 font-bold text-foreground hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60">
          {t("common.load_more")}
        </button>
      )}
    </section>
  );
}