'use client';

import { ArrowLeft, CheckCircle2, LockKeyhole, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Container } from '@/components/Container';
import type { Election, Poll } from '@/lib/api/governance';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';

export function PollDetail({ initialPoll }: { initialPoll: Poll }) {
  const [poll, setPoll] = useState(initialPoll);
  const { lang, t } = useTranslation();
  const countsVisible = poll.options.every((option) => option.voteCount !== undefined);
  const totalVotes = poll.options.reduce((sum, option) => sum + (option.voteCount ?? 0), 0);

  return (
    <DetailLayout title={lang === 'ar' ? poll.questionAr : poll.question} expiresAt={poll.expiresAt}>
      {poll.myVoteOptionId && !countsVisible && <SealedNotice />}
      <VoteForm<Poll>
        kind="poll"
        itemId={poll.id}
        choices={poll.options.map((option) => ({ id: option.id, label: lang === 'ar' ? option.labelAr : option.label, count: option.voteCount }))}
        selectedId={poll.myVoteOptionId}
        expiresAt={poll.expiresAt}
        resultsVisible={countsVisible}
        totalVotes={totalVotes}
        onUpdated={setPoll}
      />
      {countsVisible && <p className="mt-6 text-center text-[length:var(--text-label)] text-muted-foreground">{totalVotes} {t('governance.votes_label')}</p>}
    </DetailLayout>
  );
}

export function ElectionDetail({ initialElection }: { initialElection: Election }) {
  const [election, setElection] = useState(initialElection);
  const { lang, t } = useTranslation();
  const description = lang === 'ar' ? election.descriptionAr : election.description;
  const resultsVisible = (election.resultsOpen || election.visibilityMode === 'LIVE_COUNT') && election.candidates.every((candidate) => candidate.voteCount !== undefined);
  const totalVotes = election.candidates.reduce((sum, candidate) => sum + (candidate.voteCount ?? 0), 0);

  return (
    <DetailLayout title={lang === 'ar' ? election.titleAr : election.title} expiresAt={election.expiresAt}>
      {description && <p className="mb-6 max-w-3xl whitespace-pre-line text-[length:var(--text-body-lg)] leading-7 text-muted-foreground">{description}</p>}
      {election.myVoteCandidateId && !resultsVisible && <SealedNotice />}
      <h2 className="mb-4 flex items-center gap-2 text-[length:var(--text-h2)] font-bold"><UsersRound aria-hidden="true" className="size-5 text-primary" />{t('governance.candidates')}</h2>
      <VoteForm<Election>
        kind="election"
        itemId={election.id}
        choices={election.candidates.map((candidate) => ({ id: candidate.id, label: lang === 'ar' ? candidate.nameAr : candidate.name, description: lang === 'ar' ? candidate.statementAr : candidate.statement, photoUrl: candidate.photoUrl, count: candidate.voteCount }))}
        selectedId={election.myVoteCandidateId}
        expiresAt={election.expiresAt}
        resultsVisible={resultsVisible}
        totalVotes={totalVotes}
        onUpdated={setElection}
      />
      {resultsVisible && <p className="mt-6 text-center text-[length:var(--text-label)] text-muted-foreground">{totalVotes} {t('governance.votes_label')}</p>}
    </DetailLayout>
  );
}

export function GovernanceUnavailable({ kind }: { kind: 'poll' | 'election' }) {
  const { t } = useTranslation();
  return (
    <Container className="py-16">
      <div role="alert" className="mx-auto max-w-3xl border-y border-border py-12 text-center">
        <h1 className="text-[length:var(--text-h2)] font-bold">{t('common.error')}</h1>
        <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">
          {t(kind === 'poll' ? 'governance.poll_unavailable' : 'governance.election_unavailable')}
        </p>
        <Link href="/governance" className="mt-5 inline-flex min-h-11 items-center font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
          {t('governance.back')}
        </Link>
      </div>
    </Container>
  );
}

type Choice = { id: string; label: string; description?: string | null; photoUrl?: string | null; count?: number };

function VoteForm<T extends Poll | Election>({ kind, itemId, choices, selectedId, expiresAt, resultsVisible, totalVotes, onUpdated }: { kind: 'poll' | 'election'; itemId: string; choices: Choice[]; selectedId: string | null; expiresAt: string; resultsVisible: boolean; totalVotes: number; onUpdated: (value: T) => void }) {
  const { isLoading, user } = useAuth();
  const { t } = useTranslation();
  const [pendingChoice, setPendingChoice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [expired] = useState(() => new Date(expiresAt).getTime() <= Date.now());
  const canVote = !expired && !selectedId && user?.role === 'RESIDENT';

  async function submitVote(event: React.FormEvent) {
    event.preventDefault();
    if (!pendingChoice || !canVote || isSubmitting) return;
    const choice = choices.find((item) => item.id === pendingChoice);
    if (!choice || !window.confirm(t('governance.vote_confirm').replace('{{option}}', choice.label))) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const key = kind === 'poll' ? 'optionId' : 'candidateId';
      const response = await fetch(`/api/governance/${kind === 'poll' ? 'polls' : 'elections'}/${encodeURIComponent(itemId)}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: pendingChoice }),
      });
      if (!response.ok) {
        if (response.status === 401) setMessage({ error: true, text: t('errors.session_expired') });
        else if (response.status === 403) setMessage({ error: true, text: t('governance.residents_only') });
        else if (response.status === 409) setMessage({ error: true, text: t('governance.already_voted') });
        else if (response.status === 400) setMessage({ error: true, text: t('governance.voting_closed') });
        else setMessage({ error: true, text: t('governance.vote_failed') });
        return;
      }
      const payload = (await response.json()) as { data: T };
      onUpdated(payload.data);
      setMessage({ error: false, text: t('governance.vote_submitted') });
    } catch {
      setMessage({ error: true, text: t('errors.network') });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submitVote(event)}>
      <fieldset disabled={!canVote || isSubmitting} className="space-y-3">
        <legend className="sr-only">{t('governance.vote')}</legend>
        {choices.map((choice) => {
          const chosen = selectedId === choice.id;
          const percent = resultsVisible && totalVotes > 0 ? Math.round(((choice.count ?? 0) / totalVotes) * 100) : 0;
          return (
            <label key={choice.id} className={`relative block min-h-16 overflow-hidden rounded-md border bg-card p-4 transition-colors ${chosen ? 'border-primary' : 'border-border'} ${canVote ? 'hover:border-primary' : ''}`}>
              {resultsVisible && <span aria-hidden="true" className="absolute inset-y-0 start-0 bg-primary/12" style={{ width: `${percent}%` }} />}
              <span className="relative flex items-start gap-3">
                {choice.photoUrl && (
                  <span
                    aria-hidden="true"
                    className="size-12 shrink-0 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${JSON.stringify(choice.photoUrl)})` }}
                  />
                )}
                <input type="radio" name="vote" value={choice.id} checked={(canVote ? pendingChoice : selectedId) === choice.id} onChange={() => setPendingChoice(choice.id)} className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--text-body-lg)] font-bold text-foreground">{choice.label}</span>
                  {choice.description && <span className="mt-1 block text-[length:var(--text-body)] leading-6 text-muted-foreground">{choice.description}</span>}
                </span>
                {resultsVisible && <span className="shrink-0 text-[length:var(--text-label)] font-bold text-foreground">{choice.count ?? 0} ({percent}%)</span>}
                {chosen && <CheckCircle2 aria-label={t('governance.your_vote')} className="size-5 shrink-0 text-primary" />}
              </span>
            </label>
          );
        })}
      </fieldset>

      {!isLoading && !user && !expired && <Link href="/login" className="mt-5 inline-flex min-h-12 items-center rounded-md bg-primary px-6 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">{t('governance.sign_in_to_vote')}</Link>}
      {!isLoading && user && user.role !== 'RESIDENT' && !expired && <p className="mt-5 text-[length:var(--text-body)] text-muted-foreground">{t('governance.residents_only')}</p>}
      {expired && !selectedId && <p className="mt-5 text-[length:var(--text-body)] text-muted-foreground">{t('governance.voting_closed')}</p>}
      {canVote && <button type="submit" disabled={!pendingChoice || isSubmitting} className="mt-5 min-h-12 rounded-md bg-primary px-6 text-[length:var(--text-button)] font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-50">{isSubmitting ? t('common.loading') : t('governance.submit_vote')}</button>}
      {message && <p role={message.error ? 'alert' : 'status'} className={`mt-4 rounded-sm px-4 py-3 text-[length:var(--text-body)] ${message.error ? 'bg-error/12 text-error' : 'bg-success/15 text-success'}`}>{message.text}</p>}
    </form>
  );
}

function DetailLayout({ title, expiresAt, children }: { title: string; expiresAt: string; children: React.ReactNode }) {
  const { lang, t } = useTranslation();
  const [expired] = useState(() => new Date(expiresAt).getTime() <= Date.now());
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(expiresAt));
  return (
    <Container className="py-8 sm:py-12">
      <article className="mx-auto max-w-3xl">
        <Link href="/governance" className="inline-flex min-h-11 items-center gap-2 text-[length:var(--text-label)] font-bold text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"><ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />{t('governance.back')}</Link>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-[length:var(--text-caption)] font-bold ${expired ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success'}`}>{t(expired ? 'governance.closed' : 'governance.active')}</span>
          <time dateTime={expiresAt} className="text-[length:var(--text-label)] text-muted-foreground">{t(expired ? 'governance.closed_on' : 'governance.closes_on').replace('{{date}}', date)}</time>
        </div>
        <h1 className="mt-4 text-[length:var(--text-h1)] font-bold leading-tight text-foreground">{title}</h1>
        <div className="mt-8">{children}</div>
      </article>
    </Container>
  );
}

function SealedNotice() {
  const { t } = useTranslation();
  return <div className="mb-5 flex gap-3 rounded-md border border-primary/40 bg-primary/8 p-4 text-[length:var(--text-body)] text-muted-foreground"><LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><p>{t('governance.sealed')}</p></div>;
}