"use client";

import { ArrowLeft, ImageIcon, PackageOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Container } from "@/components/Container";
import type { Product, ProductPage } from "@/lib/api/products";
import type { ProductAvailability } from "@/lib/api/products.server";
import type { Shop } from "@/lib/api/shops";
import { useTranslation } from "@/lib/i18n";

type ProductMenuProps = {
  shop: Shop | null;
  initialPage: ProductPage | null;
  initialAvailability: ProductAvailability;
  initialSearch: string;
};

const availabilityOptions = ["all", "available", "unavailable"] as const;

export function ProductMenu({
  shop,
  initialPage,
  initialAvailability,
  initialSearch,
}: ProductMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useTranslation();
  const isRtl = lang === "ar";
  const [search, setSearch] = useState(initialSearch);
  const [items, setItems] = useState(initialPage?.items ?? []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (search.trim() === initialSearch) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (initialAvailability !== "all")
        params.set("availability", initialAvailability);
      if (search.trim()) params.set("search", search.trim());
      startTransition(() =>
        router.replace(`${pathname}${params.size ? `?${params}` : ""}`),
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [initialAvailability, initialSearch, pathname, router, search]);

  async function loadMore() {
    if (!shop || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(false);

    const params = new URLSearchParams({ cursor: nextCursor });
    if (initialAvailability !== "all")
      params.set("availability", initialAvailability);
    if (initialSearch) params.set("search", initialSearch);

    try {
      const response = await fetch(
        `/api/shops/${encodeURIComponent(shop.id)}/products?${params}`,
      );
      if (!response.ok) throw new Error("Request failed");
      const payload = (await response.json()) as { data: ProductPage };
      startTransition(() => {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...payload.data.items.filter((item) => !known.has(item.id)),
          ];
        });
        setNextCursor(payload.data.nextCursor);
      });
    } catch {
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const shopName = shop ? (isRtl ? shop.nameAr : shop.name) : "";

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="menu-title" className="mx-auto max-w-6xl">
        <Link
          href={shop ? `/directory/${shop.id}` : "/directory"}
          className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
        >
          <ArrowLeft
            aria-hidden="true"
            className={`size-4.5 ${isRtl ? "rotate-180" : ""}`}
          />
          {t("common.back")}
        </Link>

        <header className="mt-6 border-b border-border pb-7">
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
            {shopName || t("directory.title")}
          </p>
          <h1
            id="menu-title"
            className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground"
          >
            {t("directory.menu")}
          </h1>
          <p className="mt-3 max-w-2xl text-[length:var(--text-body-lg)] text-muted-foreground">
            {t("directory.menu_subtitle")}
          </p>
        </header>

        <div className="mt-7 flex min-h-12 items-center gap-3 rounded-full border border-border bg-card px-4 focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-500">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <label htmlFor="product-search" className="sr-only">
            {t("directory.search_products")}
          </label>
          <input
            id="product-search"
            type="search"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("directory.search_products")}
            className="min-w-0 flex-1 bg-transparent text-[length:var(--text-body-lg)] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("common.clear")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <X aria-hidden="true" className="size-4.5" />
            </button>
          )}
        </div>

        <nav
          aria-label={t("directory.availability_filter")}
          className="announcement-filters mt-4 flex gap-2 overflow-x-auto pb-2"
        >
          {availabilityOptions.map((option) => (
            <AvailabilityLink
              key={option}
              active={initialAvailability === option}
              href={menuHref(pathname, option, initialSearch)}
              label={t(`directory.availability.${option}`)}
            />
          ))}
        </nav>

        {initialPage === null ? (
          <div role="alert" className="mt-8 border-y border-border py-10">
            <h2 className="text-[length:var(--text-h2)] font-bold text-foreground">
              {t("common.error")}
            </h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
              {t("directory.products_unavailable")}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 border-y border-border py-14 text-center">
            <PackageOpen aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-[length:var(--text-h2)] font-bold text-foreground">
              {t("directory.no_products")}
            </h2>
            <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
              {t("directory.no_products_subtitle")}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-x-8 gap-y-0 lg:grid-cols-2">
            {items.map((product) => (
              <ProductRow key={product.id} product={product} isRtl={isRtl} />
            ))}
          </div>
        )}

        {nextCursor && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoadingMore}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-[length:var(--text-button)] font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60 motion-reduce:transition-none"
            >
              {isLoadingMore ? t("common.loading") : t("common.load_more")}
            </button>
            {loadError && (
              <p role="alert" className="text-[length:var(--text-label)] text-error">
                {t("errors.server")}
              </p>
            )}
          </div>
        )}
      </section>
    </Container>
  );
}

function ProductRow({ product, isRtl }: { product: Product; isRtl: boolean }) {
  const { lang, t } = useTranslation();
  const name = isRtl ? product.nameAr : product.name;
  const description = isRtl ? product.descriptionAr : product.description;
  const price = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(product.price);

  return (
    <article className="grid min-h-36 grid-cols-[minmax(0,1fr)_7rem] gap-5 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <div className="min-w-0 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[length:var(--text-h3)] font-bold text-foreground">
            {name}
          </h2>
          {!product.isAvailable && (
            <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-muted px-2.5 text-[length:var(--text-caption)] font-bold text-muted-foreground">
              {t("directory.availability.unavailable")}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-2 line-clamp-2 text-[length:var(--text-body)] leading-6 text-muted-foreground">
            {description}
          </p>
        )}
        <p className="mt-3 text-[length:var(--text-body-lg)] font-bold text-primary">
          {price}
        </p>
      </div>
      {product.imageUrl ? (
        <div
          role="img"
          aria-label={name}
          className={`aspect-square w-full rounded-md bg-cover bg-center ${product.isAvailable ? "" : "opacity-60 grayscale"}`}
          style={{ backgroundImage: `url(${JSON.stringify(product.imageUrl)})` }}
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted">
          <ImageIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        </div>
      )}
    </article>
  );
}

function AvailabilityLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function menuHref(
  pathname: string,
  availability: ProductAvailability,
  search: string,
): string {
  const params = new URLSearchParams();
  if (availability !== "all") params.set("availability", availability);
  if (search) params.set("search", search);
  return `${pathname}${params.size ? `?${params}` : ""}`;
}