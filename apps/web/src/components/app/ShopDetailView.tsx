"use client";

import {
  ArrowLeft,
  Clock3,
  MessageCircle,
  Phone,
  Star,
  Store,
} from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/Container";
import type { Shop, ShopCategory, WorkingHoursDay } from "@/lib/api/shops";
import { useTranslation } from "@/lib/i18n";

const categoryTranslationKeys = {
  CAFE_AND_FOOD: "directory.cafe_food",
  GROCERY: "directory.grocery",
  BUTCHER: "directory.butcher",
  SERVICES: "directory.services",
  OTHER: "directory.other",
} satisfies Record<ShopCategory, string>;

const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function ShopDetailView({ shop }: { shop: Shop | null }) {
  const { lang, t } = useTranslation();
  const isRtl = lang === "ar";

  if (!shop) {
    return (
      <Container className="py-12 sm:py-20">
        <div
          role="alert"
          className="mx-auto max-w-5xl border-y border-border py-12"
        >
          <h1 className="text-[length:var(--text-h1)] font-bold text-foreground">
            {t("common.error")}
          </h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {t("directory.shop_unavailable")}
          </p>
          <BackLink isRtl={isRtl} label={t("common.back")} />
        </div>
      </Container>
    );
  }

  const name = isRtl ? shop.nameAr : shop.name;
  const description = isRtl ? shop.descriptionAr : shop.description;
  const photos = [...shop.photos].sort(
    (left, right) => left.order - right.order,
  );
  const primaryPhoto = photos.find((photo) => photo.isPrimary) ?? photos[0];
  const secondaryPhotos = photos
    .filter((photo) => photo.id !== primaryPhoto?.id)
    .slice(0, 2);
  const hours = dayKeys.flatMap((day) =>
    shop.workingHours?.[day] ? [[day, shop.workingHours[day]] as const] : [],
  );
  const whatsappNumber = shop.whatsapp?.replace(/[^\d]/g, "") ?? "";

  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto w-full max-w-6xl">
        <BackLink isRtl={isRtl} label={t("common.back")} />

        <div className="mt-6 grid gap-2 overflow-hidden rounded-lg bg-muted md:grid-cols-[2fr_1fr]">
          <Photo
            photoUrl={primaryPhoto?.url}
            label={name}
            className="aspect-[16/10] md:aspect-auto md:min-h-[30rem]"
          />
          <div className="hidden gap-2 md:grid md:grid-rows-2">
            {secondaryPhotos.length > 0 ? (
              secondaryPhotos.map((photo) => (
                <Photo
                  key={photo.id}
                  photoUrl={photo.url}
                  label={name}
                  className="min-h-0"
                />
              ))
            ) : (
              <Photo label={name} className="row-span-2 min-h-0" />
            )}
          </div>
        </div>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:py-12">
          <div className="min-w-0">
            <header className="border-b border-border pb-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
                  {t(categoryTranslationKeys[shop.category])}
                </span>
                <span
                  className={`inline-flex min-h-8 items-center rounded-full px-3 text-[length:var(--text-caption)] font-bold ${shop.isOpen ? "bg-success text-success-foreground" : "border border-border bg-muted text-foreground"}`}
                >
                  {shop.isOpen
                    ? t("directory.open_now")
                    : t("directory.closed_now")}
                </span>
              </div>
              <h1 className="mt-4 text-[length:var(--text-h1)] font-bold leading-tight text-foreground">
                {name}
              </h1>
              <div className="mt-4 flex items-center gap-2 text-[length:var(--text-label)] text-muted-foreground">
                <Star
                  aria-hidden="true"
                  className={`size-4 ${shop.averageRating === null ? "text-muted-foreground" : "fill-primary text-primary"}`}
                />
                {shop.averageRating === null ? (
                  <span>{t("directory.no_reviews")}</span>
                ) : (
                  <span>
                    <strong className="text-foreground">
                      {shop.averageRating.toFixed(1)}
                    </strong>{" "}
                    · {shop.reviewCount}{" "}
                    {t("directory.reviews_tab").toLowerCase()}
                  </span>
                )}
              </div>
            </header>

            {description && (
              <p className="whitespace-pre-line border-b border-border py-8 text-[length:var(--text-body-lg)] leading-8 text-foreground">
                {description}
              </p>
            )}

            {hours.length > 0 && (
              <section aria-labelledby="working-hours-title" className="py-8">
                <div className="flex items-center gap-3">
                  <Clock3 aria-hidden="true" className="size-5 text-primary" />
                  <h2
                    id="working-hours-title"
                    className="text-[length:var(--text-h2)] font-bold text-foreground"
                  >
                    {t("directory.working_hours")}
                  </h2>
                </div>
                <dl className="mt-5 divide-y divide-border border-y border-border">
                  {hours.map(([day, value]) => (
                    <HoursRow key={day} day={day} value={value} />
                  ))}
                </dl>
              </section>
            )}
          </div>

          {(shop.phone || whatsappNumber) && (
            <aside
              aria-labelledby="contact-title"
              className="border-t border-border pt-8 lg:border-s lg:border-t-0 lg:ps-8 lg:pt-0"
            >
              <h2
                id="contact-title"
                className="text-[length:var(--text-h2)] font-bold text-foreground"
              >
                {t("directory.contact")}
              </h2>
              <div className="mt-5 grid gap-3">
                {shop.phone && (
                  <a
                    href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex min-h-12 items-center gap-3 rounded-md border border-border bg-card px-4 text-[length:var(--text-label)] font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
                  >
                    <Phone aria-hidden="true" className="size-4.5" />
                    <span className="min-w-0 break-all" dir="ltr">
                      {shop.phone}
                    </span>
                  </a>
                )}
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-3 rounded-md border border-border bg-card px-4 text-[length:var(--text-label)] font-bold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
                  >
                    <MessageCircle aria-hidden="true" className="size-4.5" />
                    WhatsApp
                  </a>
                )}
              </div>
            </aside>
          )}
        </div>
      </article>
    </Container>
  );
}

function BackLink({ isRtl, label }: { isRtl: boolean; label: string }) {
  return (
    <Link
      href="/directory"
      className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 motion-reduce:transition-none"
    >
      <ArrowLeft
        aria-hidden="true"
        className={`size-4.5 ${isRtl ? "rotate-180" : ""}`}
      />
      {label}
    </Link>
  );
}

function Photo({
  photoUrl,
  label,
  className,
}: {
  photoUrl?: string;
  label: string;
  className: string;
}) {
  return photoUrl ? (
    <div
      role="img"
      aria-label={label}
      className={`bg-cover bg-center ${className}`}
      style={{ backgroundImage: `url(${JSON.stringify(photoUrl)})` }}
    />
  ) : (
    <div className={`flex items-center justify-center bg-muted ${className}`}>
      <Store aria-hidden="true" className="size-12 text-muted-foreground" />
    </div>
  );
}

function HoursRow({
  day,
  value,
}: {
  day: (typeof dayKeys)[number];
  value: WorkingHoursDay;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-12 grid-cols-[minmax(5rem,1fr)_auto] items-center gap-4 py-3 text-[length:var(--text-body)]">
      <dt className="font-semibold text-foreground">
        {t(`directory.days.${day}`)}
      </dt>
      <dd
        className="text-muted-foreground"
        dir={value.closed ? undefined : "ltr"}
      >
        {value.closed ? t("common.closed") : `${value.open} – ${value.close}`}
      </dd>
    </div>
  );
}
