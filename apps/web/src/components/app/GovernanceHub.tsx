'use client';

import { CheckCircle2, Landmark, ListChecks, Vote } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useState } from 'react';

import { Container } from '@/components/Container';
import type { Election, ElectionPage, Poll, PollPage } from '@/lib/api/governance';
import { useTranslation } from '@/lib/i18n';

type GovernanceHubProps = {
  initialPolls: PollPage | null;
  initialElections: ElectionPage | null;
};

export function GovernanceHub({ initialPolls, initialElections }: GovernanceHubProps) {
  const { lang, t } = useTranslation();
  const [tab, setTab] = useState<'polls' | 'elections'>('polls');
  const [polls, setPolls] = useState(initialPolls?.items ?? []);
  const [elections, setElections] = useState(initialElections?.items ?? []);
  const [pollCursor, setPollCursor] = useState(initialPolls?.nextCursor);
  const [electionCursor, setElectionCursor] = useState(initialElections?.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const activeUnavailable = tab === 'polls' ? initialPolls === null : initialElections === null;
  const activeItems = tab === 'polls' ? polls : elections;
  const cursor = tab === 'polls' ? pollCursor : electionCursor;

  async function loadMore() {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/governance/${tab}?cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error('Request failed');
      if (tab === 'polls') {
        const payload = (await response.json()) as { data: PollPage };
        startTransition(() => {
          setPolls((current) => mergeById(current, payload.data.items));
          setPollCursor(payload.data.nextCursor);
        });
      } else {
        const payload = (await response.json()) as { data: ElectionPage };
        startTransition(() => {
          setElections((current) => mergeById(current, payload.data.items));
          setElectionCursor(payload.data.nextCursor);
        });
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <section aria-labelledby="governance-title" className="mx-auto max-w-5xl">
        <div className="max-w-[44rem]">
          <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">
            {t('community.title')}
          </p>
          <h1 id="governance-title" className="mt-2 text-[length:var(--text-h1)] font-bold">
            {t('governance.title')}
          </h1>
          <p className="mt-3 text-[length:var(--text-body-lg)] text-muted-foreground">
            {t('governance.subtitle')}
          </p>
        </div>

        <div role="tablist" aria-label={t('governance.title')} className="mt-8 grid max-w-md grid-cols-2 border-b border-border">
          {(['polls', 'elections'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-12 border-b-2 px-4 text-[length:var(--text-body)] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t(`governance.${value}`)}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-6">
          {activeUnavailable ? (
            <StatusMessage icon={Landmark} title={t('common.error')} body={t('governance.unavailable')} alert />
          ) : activeItems.length === 0 ? (
            <StatusMessage
              icon={tab === 'polls' ? ListChecks : Vote}
              title={t(tab === 'polls' ? 'governance.no_polls' : 'governance.no_elections')}
              body={t('governance.empty_subtitle')}
            />
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {tab === 'polls'
                ? polls.map((poll) => <PollRow key={poll.id} poll={poll} lang={lang} />)
                : elections.map((election) => <ElectionRow key={election.id} election={election} lang={lang} />)}
            </div>
          )}
        </div>

        {cursor && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={() => void loadMore()}
              className="min-h-12 rounded-md border border-border bg-card px-6 text-[length:var(--text-button)] font-bold hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-60"
            >
              {isLoadingMore ? t('common.loading') : t('common.load_more')}
            </button>
            {loadError && <p role="alert" className="text-[length:var(--text-label)] text-error">{t('governance.unavailable')}</p>}
          </div>
        )}
      </section>
    </Container>
  );
}

function PollRow({ poll, lang }: { poll: Poll; lang: 'ar' | 'en' }) {
  const { t } = useTranslation();
  const closed = isClosed(poll.expiresAt);
  return (
    <GovernanceRow
      href={`/governance/polls/${encodeURIComponent(poll.id)}`}
      title={lang === 'ar' ? poll.questionAr : poll.question}
      type={t('governance.polls')}
      deadline={formatDeadline(poll.expiresAt, lang)}
      closed={closed}
      voted={Boolean(poll.myVoteOptionId)}
    />
  );
}

function ElectionRow({ election, lang }: { election: Election; lang: 'ar' | 'en' }) {
  const { t } = useTranslation();
  return (
    <GovernanceRow
      href={`/governance/elections/${encodeURIComponent(election.id)}`}
      title={lang === 'ar' ? election.titleAr : election.title}
      type={t('governance.elections')}
      deadline={formatDeadline(election.expiresAt, lang)}
      closed={isClosed(election.expiresAt)}
      voted={Boolean(election.myVoteCandidateId)}
      extra={`${election.candidates.length} ${t('governance.candidates')}`}
    />
  );
}

function GovernanceRow({ href, title, type, deadline, closed, voted, extra }: { href: string; title: string; type: string; deadline: string; closed: boolean; voted: boolean; extra?: string }) {
  const { t } = useTranslation();
  return (
    <article className="py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2 text-[length:var(--text-caption)] font-bold">
        <span className="rounded-full bg-muted px-3 py-1.5 text-foreground">{type}</span>
        <span className={closed ? 'text-muted-foreground' : 'text-success'}>{t(closed ? 'governance.closed' : 'governance.active')}</span>
        {voted && <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 aria-hidden="true" className="size-4" />{t('governance.voted')}</span>}
      </div>
      <h2 className="mt-3 max-w-3xl text-[length:var(--text-h2)] font-bold">
        <Link href={href} prefetch={true} className="hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">{title}</Link>
      </h2>
      <p className="mt-2 text-[length:var(--text-label)] text-muted-foreground">
        {t(closed ? 'governance.closed_on' : 'governance.closes_on').replace('{{date}}', deadline)}
        {extra ? ` · ${extra}` : ''}
      </p>
    </article>
  );
}

function StatusMessage({ icon: Icon, title, body, alert = false }: { icon: typeof Landmark; title: string; body: string; alert?: boolean }) {
  return (
    <div role={alert ? 'alert' : undefined} className="border-y border-border py-12 text-center">
      <Icon aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 text-[length:var(--text-h2)] font-bold">{title}</h2>
      <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{body}</p>
    </div>
  );
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !ids.has(item.id))];
}

function isClosed(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function formatDeadline(expiresAt: string, lang: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' }).format(new Date(expiresAt));
}