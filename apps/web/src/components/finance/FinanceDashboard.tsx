'use client';

import {
  ArrowUpRight,
  Building2,
  Check,
  CircleAlert,
  Clock3,
  Landmark,
  PlusCircle,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { financeApi } from '@/lib/api/finance';
import {
  attentionCards,
  checklist,
  deltaView,
  flatsHref,
  highestOutstanding,
  isPositive,
  monthStart,
  timelineKind,
  timelineLabelKey,
  type AttentionCard,
  type Dashboard,
  type DeltaView,
} from '@/lib/finance/dashboard';
import { formatDecimalAmount } from '@/lib/finance/money';
import type { AuditItem } from '@/lib/finance/schemas';
import { useTranslation } from '@/lib/i18n';

import {
  BarsBilledCollected,
  CompoundMap,
  Donut,
  HBars,
  Ring,
  Sparkline,
  StackedBar,
  useChartLabels,
} from './charts';
import { monthName } from './charts/geometry';
import { FOCUS, Notice, PRIMARY_BUTTON, SECONDARY_BUTTON, useFinanceError } from './parts';

const CARD = 'rounded-lg border border-border bg-card shadow-sm';
const SECTION_TITLE = 'text-[length:var(--text-h3)] font-bold';
const LINK = `inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-primary hover:underline ${FOCUS}`;
const TH = 'px-3 py-2 text-start text-[length:var(--text-label)] font-semibold text-muted-foreground';

type Lang = 'ar' | 'en';

const intl = (lang: Lang) => (lang === 'ar' ? 'ar-EG' : 'en-US');

/** A decimal-string amount: bidi-isolated, tabular, formatted from the string itself. */
function Amt({ value, lang, unit = true, className = '' }: { value: string; lang: Lang; unit?: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={className}>
      <bdi className="tabular-nums">{formatDecimalAmount(value, lang)}</bdi>
      {unit && <small className="ms-1 text-muted-foreground">{t('finance.charts.egp')}</small>}
    </span>
  );
}

/** Compact "3.42M / 412K" for chips (display only, formatted from the decimal string). */
function compactMoney(value: string, lang: Lang): string {
  return new Intl.NumberFormat(intl(lang), { notation: 'compact', maximumFractionDigits: 2 }).format(value as unknown as number);
}

const DELTA_TONE: Record<DeltaView['tone'], string> = {
  good: 'text-success',
  bad: 'text-error',
  neutral: 'text-muted-foreground',
};

function Delta({ view }: { view: DeltaView }) {
  return (
    <span className={`font-semibold tabular-nums ${DELTA_TONE[view.tone]}`} dir="ltr">
      <bdi>{view.text}</bdi>
    </span>
  );
}

const TONE_BORDER: Record<AttentionCard['tone'], string> = {
  warning: 'border-s-warning text-warning',
  error: 'border-s-error text-error',
  gold: 'border-s-primary text-primary',
  info: 'border-s-info text-info',
};
const TONE_ICON: Record<AttentionCard['id'], LucideIcon> = {
  unapplied: TriangleAlert,
  over90: CircleAlert,
  building: Building2,
  cheques: Landmark,
  period: Clock3,
};

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className}`} />;
}

/** Section-shaped placeholders while the endpoint answers. */
function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{t('common.loading')}</span>
      <div className={`${CARD} grid gap-6 p-6 md:grid-cols-[220px_1fr]`}>
        <Skeleton className="mx-auto size-[200px] rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-72" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/** sample-4 landing: ledger-and-map dashboard for the finance desk (accounting slice 9). */
export function FinanceDashboard() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const errorMessage = useFinanceError();
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    financeApi
      .dashboard({ months: 12 })
      .then((next) => live && setData(next))
      .catch((caught: unknown) => live && setError(errorMessage(caught)));
    return () => {
      live = false;
    };
  }, [attempt, errorMessage]);

  const retry = () => {
    setError('');
    setData(null);
    setAttempt((n) => n + 1);
  };

  const monthLabel = data ? `${monthName(data.period.period, lang, 'long')} ${data.period.period.slice(0, 4)}` : '';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[length:var(--text-label)] font-semibold text-muted-foreground">
            {data ? t('finance.dashboard.eyebrow', { month: monthLabel }) : t('finance.desk')}
          </div>
          <h1 className="mt-1 text-[length:var(--text-h1)] font-bold leading-tight">
            {user?.name ? t('finance.dashboard.title_named', { name: user.name }) : t('finance.dashboard.title')}
          </h1>
          <div aria-hidden="true" className="mt-3 h-0.5 w-16 rounded-full bg-primary" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-[length:var(--text-caption)] font-semibold">
              <i aria-hidden="true" className={`size-2 rounded-full ${data.period.status === 'OPEN' ? 'bg-success' : 'bg-warning'}`} />
              {t('finance.dashboard.period_pill', {
                period: data.period.period,
                status: t(`finance.dashboard.status_${data.period.status}`),
              })}
            </span>
          )}
          <Link href="/finance/payments/new" className={PRIMARY_BUTTON}>
            <PlusCircle aria-hidden="true" className="size-4.5" />
            {t('finance.nav.record_payment')}
          </Link>
          <Link href="/finance/flats" className={SECONDARY_BUTTON}>
            {t('finance.dashboard.find_flat')}
          </Link>
        </div>
      </header>

      {error ? (
        <Notice tone="error">
          <p>{error}</p>
          <button
            type="button"
            onClick={retry}
            className={`mt-2 inline-flex min-h-11 items-center rounded-md border border-border px-4 font-semibold hover:bg-muted ${FOCUS}`}
          >
            {t('finance.dashboard.retry')}
          </button>
        </Notice>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardBody data={data} />
      )}
    </div>
  );
}

function DashboardBody({ data }: { data: Dashboard }) {
  const { t, lang } = useTranslation();
  const labels = useChartLabels();
  const [picked, setPicked] = React.useState<string | undefined>(undefined);
  // Sample 4 opens with the building owing the most selected; ties go to the lower code.
  const top = highestOutstanding(data.byBuilding);
  const selected = picked ?? top?.building ?? null;
  const building = data.byBuilding.find((b) => b.building === selected) ?? null;

  const monthLabel = monthName(data.period.period, lang, 'long');
  const cards = attentionCards(data);
  const checks = checklist(data);
  const okCount = checks.filter((c) => c.state === 'ok').length;
  const egp = t('finance.charts.egp');
  const money = (v: string) => `${formatDecimalAmount(v, lang)} ${egp}`;
  const count = new Intl.NumberFormat(intl(lang));
  const lastCollected = data.collected[data.collected.length - 1]?.amount ?? '0.00';
  const noDebt = !isPositive(data.outstanding);

  const kpis: {
    id: string;
    label: string;
    value: React.ReactNode;
    delta: DeltaView;
    points: { label: string; value: string }[];
    color: string;
    note?: string;
  }[] = [
    {
      id: 'collected',
      label: t('finance.dashboard.kpi_collected'),
      value: <Amt value={lastCollected} lang={lang} />,
      delta: deltaView(data.deltas.collected, true),
      points: data.collected.map((m) => ({ label: monthName(m.period, lang), value: m.amount })),
      color: 'var(--chart-1)',
    },
    {
      id: 'outstanding',
      label: t('finance.dashboard.kpi_outstanding'),
      value: <Amt value={data.outstanding} lang={lang} />,
      delta: deltaView(data.deltas.outstanding, false),
      points: data.series.map((p) => ({ label: monthName(p.period, lang), value: p.outstanding })),
      color: 'var(--chart-4)',
    },
    {
      id: 'owing',
      label: t('finance.dashboard.kpi_owing'),
      value: (
        <span>
          <bdi className="tabular-nums">{count.format(data.owingFlats)}</bdi>
          <small className="ms-1 text-muted-foreground">
            / <bdi className="tabular-nums">{count.format(data.totalFlats)}</bdi>
          </small>
        </span>
      ),
      delta: deltaView(data.deltas.owingFlats, false),
      points: data.series.map((p) => ({ label: monthName(p.period, lang), value: String(p.owingFlats) })),
      color: 'var(--color-error)',
    },
    {
      id: 'fund',
      label: t('finance.dashboard.kpi_fund'),
      value: <Amt value={data.fundBalance} lang={lang} />,
      delta: deltaView(data.deltas.fundBalance, true),
      points: data.series.map((p) => ({ label: monthName(p.period, lang), value: p.fundBalance })),
      color: 'var(--chart-3)',
      note: t('finance.dashboard.deposits_line', { billed: money(data.deposits.billed), collected: money(data.deposits.collected) }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* hero */}
      <section
        aria-label={t('finance.charts.ring_caption')}
        className={`${CARD} grid items-center gap-6 bg-gradient-to-br from-primary/10 to-card p-6 md:grid-cols-[220px_1fr] md:gap-8 md:p-7`}
      >
        <div className="flex justify-center">
          <Ring rate={data.cohort.rate} lang={lang} caption={t('finance.dashboard.ring_caption')} size={200} />
        </div>
        <div className="text-center md:text-start">
          <div className="text-[length:var(--text-label)] font-semibold text-muted-foreground">{monthLabel}</div>
          {isPositive(data.cohort.charges) ? (
            <>
              <h2 className="mt-1 text-[length:var(--text-h1)] font-light leading-snug">
                {t('finance.dashboard.story_collected')}{' '}
                <bdi className="font-bold tabular-nums text-primary">{formatDecimalAmount(data.cohort.allocated, lang)}</bdi>{' '}
                {t('finance.dashboard.story_of')} <bdi className="tabular-nums">{formatDecimalAmount(data.cohort.charges, lang)}</bdi> {egp}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {t('finance.dashboard.story_sub', {
                  open: money(data.cohort.open),
                  owing: count.format(data.owingFlats),
                  total: count.format(data.totalFlats),
                  outstanding: money(data.outstanding),
                })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[length:var(--text-h3)] text-muted-foreground">{t('finance.dashboard.story_empty')}</p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
            <Chip>
              {t('finance.dashboard.chip_fund')}{' '}
              <b className="tabular-nums">
                <bdi>{compactMoney(data.fundBalance, lang)}</bdi>
              </b>
            </Chip>
            <Chip>
              {t('finance.dashboard.chip_billed')}{' '}
              <b className="tabular-nums">
                <bdi>{compactMoney(data.cohort.charges, lang)}</bdi>
              </b>
            </Chip>
            <Chip>
              {t('finance.dashboard.kpi_collected')} <Delta view={deltaView(data.deltas.collected, true)} />
            </Chip>
          </div>
        </div>
      </section>

      {/* KPI tiles */}
      <section aria-label={t('finance.dashboard.kpi_title')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <article key={k.id} className={`${CARD} p-5`}>
            <div className="text-[length:var(--text-caption)] font-semibold text-muted-foreground">{k.label}</div>
            <div className="my-2 text-[length:var(--text-h2)] font-light leading-snug">{k.value}</div>
            <div className="flex items-center justify-between gap-2 text-[length:var(--text-caption)]">
              <span>
                <Delta view={k.delta} /> <span className="text-muted-foreground">{t('finance.dashboard.vs_last')}</span>
              </span>
              <Sparkline
                points={k.points}
                lang={lang}
                label={`${k.label}: ${labels.sparkline.label}`}
                columns={labels.sparkline.columns}
                color={k.color}
              />
            </div>
            {k.note && (
              <p className="mt-2 text-[length:var(--text-caption)] text-muted-foreground" title={k.note}>
                {k.note}
              </p>
            )}
          </article>
        ))}
      </section>

      {/* attention */}
      <section aria-labelledby="fd-attention">
        <h2 id="fd-attention" className="mb-3 font-semibold text-muted-foreground">
          {t('finance.dashboard.att_title')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <AttentionCardView key={card.id} card={card} lang={lang} />
          ))}
        </div>
      </section>

      {/* map + building panel */}
      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className={`${CARD} p-5`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className={SECTION_TITLE}>{labels.map.title}</h2>
            <div className="flex items-center gap-2 text-[length:var(--text-caption)] text-muted-foreground">
              <span>{labels.map.less}</span>
              <i aria-hidden="true" className="inline-block h-2 w-24 rounded-full bg-gradient-to-r from-muted to-error" />
              <span>{labels.map.more}</span>
            </div>
          </div>
          <CompoundMap buildings={data.byBuilding} lang={lang} selected={selected} onSelect={(code) => setPicked(code)} labels={labels.map} />
          <p className="mt-2 text-[length:var(--text-caption)] text-muted-foreground">{labels.map.hint}</p>
        </div>
        <aside aria-live="polite" className={`${CARD} p-5`}>
          <BuildingPanel data={data} building={building} />
        </aside>
      </section>

      {/* billed vs collected */}
      <section className={`${CARD} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className={SECTION_TITLE}>{labels.bars.title}</h2>
          <div className="flex items-center gap-4 text-[length:var(--text-caption)] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="size-2.5 rounded-sm opacity-60" style={{ background: 'var(--chart-5)' }} />
              {labels.bars.billed}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: 'var(--chart-1)' }} />
              {labels.bars.collected}
            </span>
          </div>
        </div>
        <BarsBilledCollected billed={data.billed} collected={data.collected} lang={lang} labels={labels.bars} height={280} />
      </section>

      {/* aging | methods */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD} p-5`}>
          <h2 className={`${SECTION_TITLE} mb-4 border-b border-border pb-3`}>{labels.aging.title}</h2>
          {noDebt ? (
            <p className="py-6 text-center text-muted-foreground">{t('finance.dashboard.no_overdue')}</p>
          ) : (
            <StackedBar
              lang={lang}
              labels={labels.aging}
              items={[
                { key: 'current', label: labels.aging.current, amount: data.aging.current, color: 'var(--chart-a1)' },
                { key: 'd31_60', label: labels.aging.d31_60, amount: data.aging.d31_60, color: 'var(--chart-a2)' },
                { key: 'd61_90', label: labels.aging.d61_90, amount: data.aging.d61_90, color: 'var(--chart-a3)' },
                { key: 'over90', label: labels.aging.over90, amount: data.aging.over90, color: 'var(--chart-a4)' },
              ]}
            />
          )}
        </section>
        <section className={`${CARD} p-5`}>
          <h2 className={`${SECTION_TITLE} mb-4 border-b border-border pb-3`}>{labels.donut.title}</h2>
          <Donut methods={data.receiptsByMethod} lang={lang} labels={labels.donut} />
        </section>
      </div>

      {/* timeline | unapplied */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Timeline asOf={data.asOf} period={data.period.period} />
        <section className={`${CARD} p-5`}>
          <h2 className={`${SECTION_TITLE} mb-4 border-b border-border pb-3`}>{t('finance.dashboard.unap_title')}</h2>
          <div className="mb-3 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <div className="text-muted-foreground">{t('finance.dashboard.unap_total')}</div>
              <Amt value={data.unapplied.total} lang={lang} className="text-[length:var(--text-h2)]" />
            </div>
            <div>
              <div className="text-muted-foreground">{t('finance.dashboard.unap_credits')}</div>
              <Amt value={data.credit.netCreditTotal} lang={lang} className="text-[length:var(--text-h2)]" />
              <small className="ms-2 text-muted-foreground tabular-nums">· {count.format(data.credit.netCreditFlats)}</small>
            </div>
          </div>
          {data.unapplied.oldest.length === 0 ? (
            <p className="py-4 text-muted-foreground">{t('finance.dashboard.unap_empty')}</p>
          ) : (
            <ul>
              {data.unapplied.oldest.map((u) => (
                <li
                  key={u.paymentId}
                  className="flex items-center justify-between gap-3 border-t border-dashed border-border py-2 text-[length:var(--text-body)]"
                >
                  <span>
                    <Link href={`/finance/flats/${encodeURIComponent(u.flatId)}`} className={`font-bold hover:text-primary ${FOCUS}`}>
                      <bdi dir="ltr">{u.flatLabel}</bdi>
                    </Link>{' '}
                    <small className="text-muted-foreground">
                      {(labels.donut.method as Record<string, string>)[u.method] ?? u.method} · {t('finance.dashboard.days_ago', { days: u.ageDays })}
                    </small>
                  </span>
                  <span className="flex items-center gap-2">
                    <Amt value={u.unallocated} lang={lang} unit={false} />
                    <Link href={`/finance/flats/${encodeURIComponent(u.flatId)}`} className={LINK}>
                      {t('finance.dashboard.cta_apply')}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* top 10 */}
      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-4 border-b border-border pb-3`}>{t('finance.dashboard.top_title')}</h2>
        {data.topOwing.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">{t('finance.dashboard.no_overdue')}</p>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label={t('finance.dashboard.top_title')} tabIndex={0}>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col" className={TH}>#</th>
                  <th scope="col" className={TH}>{t('finance.flats.col_flat')}</th>
                  <th scope="col" className={TH}>{t('finance.flats.col_owner')}</th>
                  <th scope="col" className={TH}>{t('finance.payments.col_amount')}</th>
                  <th scope="col" className={TH}>{t('finance.dashboard.col_days')}</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">{t('finance.flats.open')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topOwing.map((row, i) => (
                  <tr key={row.flatId} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{count.format(i + 1)}</td>
                    <td className="px-3 py-2 font-bold">
                      <bdi dir="ltr">{row.label}</bdi>
                    </td>
                    <td className="px-3 py-2">
                      {row.ownerName ? (
                        <bdi>{row.ownerName}</bdi>
                      ) : (
                        <span className="text-muted-foreground">
                          {row.ownerDeleted ? t('finance.dashboard.former_owner') : t('finance.flats.no_owner')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Amt value={row.balance} lang={lang} />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`tabular-nums ${row.daysPastDue > 90 ? 'font-semibold text-error' : ''}`}>{count.format(row.daysPastDue)}</span>{' '}
                      <small className="text-muted-foreground">{t('finance.dashboard.day_unit')}</small>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Link href={`/finance/flats/${encodeURIComponent(row.flatId)}`} className={LINK} aria-label={t('finance.flats.open_for', { flat: row.label })}>
                        {t('finance.dashboard.cta_open')}
                        <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* checklist */}
      <section className={`${CARD} p-5`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className={SECTION_TITLE}>{t('finance.dashboard.close_title')}</h2>
          <span
            className="inline-flex min-h-8 items-center rounded-full border border-border px-3 text-[length:var(--text-caption)] font-semibold tabular-nums"
            dir="ltr"
          >
            {okCount} / {checks.length}
          </span>
        </div>
        <div aria-hidden="true" className="mb-3 h-1 rounded-full bg-muted">
          <i className="block h-full rounded-full bg-primary" style={{ width: `${(okCount / checks.length) * 100}%` }} />
        </div>
        <p className="mb-2 text-[length:var(--text-caption)] text-muted-foreground">{t('finance.dashboard.close_note')}</p>
        <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {checks.map((c) => (
            <li key={c.id} className="flex min-h-11 items-center gap-3 border-b border-dashed border-border py-2">
              <span
                aria-hidden="true"
                className={`inline-grid size-5.5 flex-none place-items-center rounded-md border ${c.state === 'ok' ? 'border-success bg-success text-success-foreground' : 'border-warning text-warning'}`}
              >
                {c.state === 'ok' ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
              </span>
              <span className="flex-1">
                <span className="sr-only">{t(`finance.dashboard.check_state_${c.state}`)}: </span>
                {t(`finance.dashboard.check_${c.id}_${c.state}`, { count: c.count ?? 0 })}
              </span>
              {c.state === 'warn' && c.href && (
                <Link href={c.href} className={LINK}>
                  {t('finance.dashboard.cta_open')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-card/60 px-3 text-[length:var(--text-caption)]">
      {children}
    </span>
  );
}

function AttentionCardView({ card, lang }: { card: AttentionCard; lang: Lang }) {
  const { t } = useTranslation();
  const Icon = TONE_ICON[card.id];
  const count = (n: number) => new Intl.NumberFormat(intl(lang)).format(n);
  const money = (v: string) => `${formatDecimalAmount(v, lang)} ${t('finance.charts.egp')}`;
  let title: string;
  let body: string;
  let cta = t('finance.dashboard.cta_open');
  switch (card.id) {
    case 'unapplied':
      title = t('finance.dashboard.att_unapplied_title');
      body = `${count(card.count)} · ${money(card.total)}`;
      cta = t('finance.dashboard.cta_apply');
      break;
    case 'over90':
      title = t('finance.dashboard.att_over90_title');
      body = card.share === null ? money(card.amount) : `${money(card.amount)} · ${formatDecimalAmount(card.share, lang, 1)}%`;
      break;
    case 'building':
      title = t('finance.dashboard.att_building_title', { building: card.building });
      body = t('finance.dashboard.att_building_body', {
        amount: money(card.outstanding),
        owing: count(card.owingFlats),
        total: count(card.totalFlats),
      });
      break;
    case 'cheques':
      title = t('finance.dashboard.att_cheques_title');
      body = `${count(card.count)} · ${money(card.total)}`;
      break;
    default:
      title = t('finance.dashboard.att_period_title', { period: card.period });
      body = t(`finance.dashboard.att_period_${card.status === 'OPEN' ? 'open' : 'closed'}`);
  }
  return (
    <article className={`${CARD} flex flex-col items-start gap-2 border-s-[3px] p-5 ${TONE_BORDER[card.tone]}`}>
      <Icon aria-hidden="true" className="size-5" />
      <h3 className="font-semibold leading-snug text-card-foreground">{title}</h3>
      <p className="flex-1 text-[length:var(--text-body)] text-muted-foreground">{body}</p>
      <Link
        href={card.href}
        className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-border px-4 font-semibold text-card-foreground hover:border-primary/60 ${FOCUS}`}
      >
        {cta}
        <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Link>
    </article>
  );
}

function BuildingPanel({
  data,
  building,
}: {
  data: Dashboard;
  building: Dashboard['byBuilding'][number] | null;
}) {
  const { t, lang } = useTranslation();
  const labels = useChartLabels();
  const fmt = (n: number) => new Intl.NumberFormat(intl(lang)).format(n);

  if (!building) return <p className="text-muted-foreground">{t('finance.dashboard.no_overdue')}</p>;

  const prefix = `${building.building}-`;
  const owing = data.topOwing.filter((row) => row.label.startsWith(prefix));
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="text-[length:var(--text-h1)] font-bold text-primary">
          <bdi dir="ltr">{building.building}</bdi>
        </h2>
        <span className="rounded-full border border-border px-3 py-1 text-[length:var(--text-caption)] tabular-nums">
          {fmt(building.owingFlats)} / {fmt(building.totalFlats)} {labels.map.flats}
        </span>
      </div>
      <Amt value={building.outstanding} lang={lang} className="text-[length:var(--text-h2)] font-light" />
      <div className="text-muted-foreground">{labels.floors.value}</div>
      <div className="mt-4 text-[length:var(--text-caption)] font-semibold text-muted-foreground">{labels.floors.label}</div>
      <HBars items={building.floors.map((f) => ({ key: f.floor, label: f.floor, amount: f.outstanding }))} lang={lang} labels={labels.floors} />
      <div className="mt-4 text-[length:var(--text-caption)] font-semibold text-muted-foreground">{t('finance.dashboard.panel_top')}</div>
      {owing.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        owing.map((row) => (
          <div key={row.flatId} className="grid grid-cols-[80px_1fr_auto] gap-2 border-b border-dashed border-border py-2">
            <Link href={`/finance/flats/${encodeURIComponent(row.flatId)}`} className={`font-bold hover:text-primary ${FOCUS}`}>
              <bdi dir="ltr">{row.label}</bdi>
            </Link>
            <span>
              {row.ownerName ? (
                <bdi>{row.ownerName}</bdi>
              ) : (
                <span className="text-muted-foreground">{row.ownerDeleted ? t('finance.dashboard.former_owner') : t('finance.flats.no_owner')}</span>
              )}
            </span>
            <Amt value={row.balance} lang={lang} unit={false} />
          </div>
        ))
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={flatsHref({ building: building.building, hasBalance: true, sort: 'balance', asOf: data.asOf })} className={LINK}>
          {t('finance.dashboard.view_flats')}
          <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
      </div>
    </>
  );
}

const DOT_COLOR: Record<ReturnType<typeof timelineKind>, string> = {
  pay: 'var(--chart-2)',
  fund: 'var(--chart-3)',
  warn: 'var(--color-error)',
  other: 'var(--chart-1)',
};

/** The month's audit entries (section 3.4): `GET /finance/audit?from=first-of-month&to=D`. */
function Timeline({ asOf, period }: { asOf: string; period: string }) {
  const { t, lang } = useTranslation();
  const [items, setItems] = React.useState<AuditItem[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    financeApi
      .audit({ from: monthStart(asOf), to: asOf, limit: 8 })
      .then((page) => live && setItems(page.items))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [asOf]);

  const when = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Cairo',
    }).format(new Date(iso));

  return (
    <section className={`${CARD} p-5`}>
      <h2 className={`${SECTION_TITLE} mb-4 border-b border-border pb-3`}>
        {t('finance.dashboard.tl_title', { month: monthName(period, lang, 'long') })}
      </h2>
      {failed ? (
        <p className="py-4 text-muted-foreground">{t('finance.dashboard.tl_error')}</p>
      ) : items === null ? (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">{t('common.loading')}</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-muted-foreground">{t('finance.dashboard.tl_empty')}</p>
      ) : (
        <ol>
          {items.map((item) => {
            const flat = typeof item.meta?.flatLabel === 'string' ? item.meta.flatLabel : null;
            const raw = item.meta?.amount;
            const amount = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : null;
            return (
              <li key={item.id} className="grid grid-cols-[104px_14px_1fr] items-center gap-2.5 py-2">
                <time dateTime={item.createdAt} className="text-[length:var(--text-caption)] text-muted-foreground tabular-nums">
                  {when(item.createdAt)}
                </time>
                <i aria-hidden="true" className="size-3 rounded-full" style={{ background: DOT_COLOR[timelineKind(item.action)] }} />
                <div>
                  {t(timelineLabelKey(item.action))}
                  {flat && (
                    <b className="ms-2">
                      <bdi dir="ltr">{flat}</bdi>
                    </b>
                  )}
                  {amount && (
                    <span className="ms-2 text-muted-foreground tabular-nums">
                      <bdi>
                        {formatDecimalAmount(amount, lang)} {t('finance.charts.egp')}
                      </bdi>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Link href="/finance/audit" className={`mt-2 ${LINK}`}>
        {t('common.see_all')}
        <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Link>
    </section>
  );
}
