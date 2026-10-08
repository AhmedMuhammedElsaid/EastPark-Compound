'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArchiveRestore, CirclePlus, History, Landmark, Megaphone, MessageSquareText, Plus, Store, Trash2, UserCog, UserPlus, UsersRound, Vote } from 'lucide-react';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { ComplaintsPanel } from '@/components/admin/AdminOperations';
import { ResidentRequestsPanel } from '@/components/admin/residents/ResidentRequestsPanel';
import { ShopsPanel } from '@/components/admin/shops/ShopsPanel';
import { ActivityLogPanel } from '@/components/admin/team/ActivityLogPanel';
import { RecycleBinPanel } from '@/components/admin/team/RecycleBinPanel';
import { TeamRolesPanel } from '@/components/admin/team/TeamRolesPanel';
import { CONTROL_CLASS, controlBorder, Field } from '@/components/form/Field';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isSuperAdminRole } from '@/lib/auth/roles';
import { useTranslation } from '@/lib/i18n';
import { announcementCategories, visibilityModes } from '@/lib/validation/admin';

type Tool = 'residents' | 'complaints' | 'shops' | 'announcement' | 'poll' | 'election' | 'candidate' | 'team' | 'activity' | 'trash';

const SUPER_ADMIN_TOOLS = new Set<Tool>(['team', 'activity', 'trash']);
type Notice = { kind: 'success' | 'error'; message: string } | null;

const text = z.string().trim().min(3).max(5_000);
const futureLocalDate = z.string().min(1).refine((value) => Date.parse(value) > Date.now());
const announcementFormSchema = z.object({
  title: text.max(200), titleAr: text.max(200), body: text, bodyAr: text,
  category: z.enum(announcementCategories), pdfUrl: z.string().trim().url().or(z.literal('')),
  publishedAt: z.string(),
});
const pollFormSchema = z.object({
  question: text.max(500), questionAr: text.max(500), expiresAt: futureLocalDate,
  options: z.array(z.object({ label: text.max(200), labelAr: text.max(200) })).min(2).max(12),
});
const electionFormSchema = z.object({
  title: text.max(200), titleAr: text.max(200), description: z.string().max(5_000),
  descriptionAr: z.string().max(5_000), expiresAt: futureLocalDate,
  visibilityMode: z.enum(visibilityModes),
});
const candidateFormSchema = z.object({
  electionId: z.string().trim().min(1).max(200), name: text.max(200), nameAr: text.max(200),
  statement: z.string().max(5_000), statementAr: z.string().max(5_000),
  photoUrl: z.string().trim().url().or(z.literal('')),
});

type AnnouncementForm = z.infer<typeof announcementFormSchema>;
type PollForm = z.infer<typeof pollFormSchema>;
type ElectionForm = z.infer<typeof electionFormSchema>;
type CandidateForm = z.infer<typeof candidateFormSchema>;

function cleanOptional(value: string) { return value.trim() || undefined; }
function toIso(value: string) { return new Date(value).toISOString(); }

async function postAdmin(path: string, body: unknown) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as { data?: { id?: string }; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? 'server');
  return payload;
}

function FormNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`rounded-md px-4 py-3 text-[length:var(--text-body)] ${notice.kind === 'success' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
      {notice.message}
    </p>
  );
}

function InputField({ id, label, error, required = true, dir, multiline, type = 'text', ...inputProps }: {
  id: string; label: string; error?: string; required?: boolean; dir?: 'ltr' | 'rtl'; multiline?: boolean; type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field id={id} label={label} error={error} required={required}>
      {(a11y) => multiline ? (
        <textarea {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} {...a11y} dir={dir} rows={5} className={`${CONTROL_CLASS} ${controlBorder(Boolean(error))} resize-y py-3`} />
      ) : (
        <input {...inputProps} {...a11y} type={type} dir={dir} className={`${CONTROL_CLASS} ${controlBorder(Boolean(error))}`} />
      )}
    </Field>
  );
}

function FormFrame({ title, intro, icon: Icon, children }: { title: string; intro: string; icon: typeof Megaphone; children: React.ReactNode }) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-8">
      <div className="mb-7 flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary"><Icon aria-hidden="true" className="size-5" /></span>
        <div><h2 id={headingId} className="text-[length:var(--text-h2)] font-bold">{title}</h2><p className="mt-1 text-[length:var(--text-body)] text-muted-foreground">{intro}</p></div>
      </div>
      {children}
    </section>
  );
}

function AnnouncementFormPanel() {
  const { t } = useTranslation(); const [notice, setNotice] = React.useState<Notice>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementFormSchema), defaultValues: { title: '', titleAr: '', body: '', bodyAr: '', category: 'GENERAL', pdfUrl: '', publishedAt: '' },
  });
  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      await postAdmin('/api/admin/announcements', { ...values, pdfUrl: cleanOptional(values.pdfUrl), publishedAt: values.publishedAt ? toIso(values.publishedAt) : undefined });
      reset(); setNotice({ kind: 'success', message: t('admin.announcement_created') });
    } catch { setNotice({ kind: 'error', message: t('admin.submit_error') }); }
  });
  const invalid = t('admin.field_error');
  return <FormFrame title={t('admin.new_announcement')} intro={t('admin.announcement_intro')} icon={Megaphone}><form onSubmit={submit} className="space-y-6" noValidate>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="announcement-title-ar" label={t('admin.title_ar')} error={errors.titleAr && invalid} dir="rtl" {...register('titleAr')} /><InputField id="announcement-title-en" label={t('admin.title_en')} error={errors.title && invalid} dir="ltr" {...register('title')} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="announcement-body-ar" label={t('admin.body_ar')} error={errors.bodyAr && invalid} dir="rtl" multiline {...register('bodyAr')} /><InputField id="announcement-body-en" label={t('admin.body_en')} error={errors.body && invalid} dir="ltr" multiline {...register('body')} /></div>
    <div className="grid gap-5 lg:grid-cols-3"><Field id="announcement-category" label={t('admin.category')} required>{(a11y) => <select {...register('category')} {...a11y} className={`${CONTROL_CLASS} ${controlBorder(false)}`}>{announcementCategories.map((category) => <option key={category} value={category}>{t(`admin.category_${category.toLowerCase()}`)}</option>)}</select>}</Field><InputField id="announcement-pdf" label={t('admin.pdf_url')} required={false} type="url" dir="ltr" error={errors.pdfUrl && invalid} {...register('pdfUrl')} /><InputField id="announcement-published" label={t('admin.publish_at')} required={false} type="datetime-local" dir="ltr" {...register('publishedAt')} /></div>
    <FormNotice notice={notice} /><Button type="submit" disabled={isSubmitting}>{isSubmitting ? t('common.loading') : t('admin.publish_announcement')}</Button>
  </form></FormFrame>;
}

function PollFormPanel() {
  const { t } = useTranslation(); const [notice, setNotice] = React.useState<Notice>(null);
  const form = useForm<PollForm>({ resolver: zodResolver(pollFormSchema), defaultValues: { question: '', questionAr: '', expiresAt: '', options: [{ label: '', labelAr: '' }, { label: '', labelAr: '' }] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'options' });
  const submit = form.handleSubmit(async (values) => { setNotice(null); try { await postAdmin('/api/admin/polls', { ...values, expiresAt: toIso(values.expiresAt) }); form.reset(); setNotice({ kind: 'success', message: t('admin.poll_created') }); } catch { setNotice({ kind: 'error', message: t('admin.submit_error') }); } });
  const invalid = t('admin.field_error');
  return <FormFrame title={t('admin.new_poll')} intro={t('admin.poll_intro')} icon={Vote}><form onSubmit={submit} className="space-y-6" noValidate>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="poll-question-ar" label={t('admin.question_ar')} error={form.formState.errors.questionAr && invalid} dir="rtl" {...form.register('questionAr')} /><InputField id="poll-question-en" label={t('admin.question_en')} error={form.formState.errors.question && invalid} dir="ltr" {...form.register('question')} /></div>
    <InputField id="poll-expiry" label={t('admin.expires_at')} error={form.formState.errors.expiresAt && invalid} type="datetime-local" dir="ltr" {...form.register('expiresAt')} />
    <fieldset className="space-y-4"><legend className="text-[length:var(--text-label)] font-semibold">{t('admin.options')}</legend>{fields.map((field, index) => <div key={field.id} className="grid gap-3 border-b border-border pb-5 lg:grid-cols-[1fr_1fr_auto]"><InputField id={`poll-option-${index}-ar`} label={`${t('admin.option')} ${index + 1} · عربي`} error={form.formState.errors.options?.[index]?.labelAr && invalid} dir="rtl" {...form.register(`options.${index}.labelAr`)} /><InputField id={`poll-option-${index}-en`} label={`${t('admin.option')} ${index + 1} · English`} error={form.formState.errors.options?.[index]?.label && invalid} dir="ltr" {...form.register(`options.${index}.label`)} /><button type="button" onClick={() => remove(index)} disabled={fields.length <= 2} aria-label={t('admin.remove_option')} className="mt-6 flex size-12 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-error disabled:opacity-30"><Trash2 aria-hidden="true" className="size-5" /></button></div>)}</fieldset>
    <button type="button" onClick={() => append({ label: '', labelAr: '' })} disabled={fields.length >= 12} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-primary hover:bg-muted disabled:opacity-40"><Plus aria-hidden="true" className="size-4" />{t('admin.add_option')}</button>
    <FormNotice notice={notice} /><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? t('common.loading') : t('admin.create_poll')}</Button>
  </form></FormFrame>;
}

function ElectionFormPanel({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation(); const [notice, setNotice] = React.useState<Notice>(null);
  const form = useForm<ElectionForm>({ resolver: zodResolver(electionFormSchema), defaultValues: { title: '', titleAr: '', description: '', descriptionAr: '', expiresAt: '', visibilityMode: 'SEALED_UNTIL_DEADLINE' } });
  const submit = form.handleSubmit(async (values) => { setNotice(null); try { const result = await postAdmin('/api/admin/elections', { ...values, description: cleanOptional(values.description), descriptionAr: cleanOptional(values.descriptionAr), expiresAt: toIso(values.expiresAt) }); const id = result?.data?.id; form.reset(); setNotice({ kind: 'success', message: t('admin.election_created') }); if (id) onCreated(id); } catch { setNotice({ kind: 'error', message: t('admin.submit_error') }); } });
  const invalid = t('admin.field_error');
  return <FormFrame title={t('admin.new_election')} intro={t('admin.election_intro')} icon={Landmark}><form onSubmit={submit} className="space-y-6" noValidate>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="election-title-ar" label={t('admin.title_ar')} error={form.formState.errors.titleAr && invalid} dir="rtl" {...form.register('titleAr')} /><InputField id="election-title-en" label={t('admin.title_en')} error={form.formState.errors.title && invalid} dir="ltr" {...form.register('title')} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="election-description-ar" label={t('admin.description_ar')} required={false} dir="rtl" multiline {...form.register('descriptionAr')} /><InputField id="election-description-en" label={t('admin.description_en')} required={false} dir="ltr" multiline {...form.register('description')} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="election-expiry" label={t('admin.expires_at')} error={form.formState.errors.expiresAt && invalid} type="datetime-local" dir="ltr" {...form.register('expiresAt')} /><Field id="election-visibility" label={t('admin.visibility_mode')} required>{(a11y) => <select {...form.register('visibilityMode')} {...a11y} className={`${CONTROL_CLASS} ${controlBorder(false)}`}>{visibilityModes.map((mode) => <option key={mode} value={mode}>{t(`admin.visibility_${mode.toLowerCase()}`)}</option>)}</select>}</Field></div>
    <FormNotice notice={notice} /><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? t('common.loading') : t('admin.create_election')}</Button>
  </form></FormFrame>;
}

function CandidateFormPanel({ electionId }: { electionId: string }) {
  const { t } = useTranslation(); const [notice, setNotice] = React.useState<Notice>(null);
  const form = useForm<CandidateForm>({ resolver: zodResolver(candidateFormSchema), defaultValues: { electionId, name: '', nameAr: '', statement: '', statementAr: '', photoUrl: '' } });
  React.useEffect(() => {
    if (electionId) form.setValue('electionId', electionId, { shouldValidate: true });
  }, [electionId, form]);
  const submit = form.handleSubmit(async (values) => { setNotice(null); try { await postAdmin(`/api/admin/elections/${encodeURIComponent(values.electionId)}/candidates`, { name: values.name, nameAr: values.nameAr, statement: cleanOptional(values.statement), statementAr: cleanOptional(values.statementAr), photoUrl: cleanOptional(values.photoUrl) }); const retainedId = values.electionId; form.reset({ electionId: retainedId, name: '', nameAr: '', statement: '', statementAr: '', photoUrl: '' }); setNotice({ kind: 'success', message: t('admin.candidate_added') }); } catch { setNotice({ kind: 'error', message: t('admin.submit_error') }); } });
  const invalid = t('admin.field_error');
  return <FormFrame title={t('admin.add_candidate')} intro={t('admin.candidate_intro')} icon={UserPlus}><form onSubmit={submit} className="space-y-6" noValidate>
    <InputField id="candidate-election" label={t('admin.election_id')} error={form.formState.errors.electionId && invalid} dir="ltr" {...form.register('electionId')} />
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="candidate-name-ar" label={t('admin.name_ar')} error={form.formState.errors.nameAr && invalid} dir="rtl" {...form.register('nameAr')} /><InputField id="candidate-name-en" label={t('admin.name_en')} error={form.formState.errors.name && invalid} dir="ltr" {...form.register('name')} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><InputField id="candidate-statement-ar" label={t('admin.statement_ar')} required={false} dir="rtl" multiline {...form.register('statementAr')} /><InputField id="candidate-statement-en" label={t('admin.statement_en')} required={false} dir="ltr" multiline {...form.register('statement')} /></div>
    <InputField id="candidate-photo" label={t('admin.photo_url')} required={false} type="url" dir="ltr" error={form.formState.errors.photoUrl && invalid} {...form.register('photoUrl')} />
    <FormNotice notice={notice} /><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? t('common.loading') : t('admin.add_candidate')}</Button>
  </form></FormFrame>;
}

export function AdminWorkspace() {
  const { t, lang } = useTranslation(); const [tool, setTool] = React.useState<Tool>('residents'); const [electionId, setElectionId] = React.useState('');
  // Team & roles, the activity log and the recycle bin are SUPER_ADMIN-only (the BFF and backend re-check).
  const isSuperAdmin = isSuperAdminRole(useAuth().user?.role);
  const tools = [
    { id: 'residents' as const, label: lang === 'ar' ? 'طلبات السكان' : 'Resident requests', icon: UsersRound },
    { id: 'complaints' as const, label: lang === 'ar' ? 'الشكاوى' : 'Complaints', icon: MessageSquareText },
    { id: 'shops' as const, label: t('admin_shops.nav_label'), icon: Store },
    { id: 'announcement' as const, label: t('admin.new_announcement'), icon: Megaphone },
    { id: 'poll' as const, label: t('admin.new_poll'), icon: Vote },
    { id: 'election' as const, label: t('admin.new_election'), icon: Landmark },
    { id: 'candidate' as const, label: t('admin.add_candidate'), icon: UserPlus },
    ...(isSuperAdmin
      ? [
          { id: 'team' as const, label: t('admin_team.nav_label'), icon: UserCog },
          { id: 'activity' as const, label: t('admin_activity.nav_label'), icon: History },
          { id: 'trash' as const, label: t('admin_trash.nav_label'), icon: ArchiveRestore },
        ]
      : []),
  ];
  const activeTool: Tool = !isSuperAdmin && SUPER_ADMIN_TOOLS.has(tool) ? 'residents' : tool;
  const electionCreated = (id: string) => { setElectionId(id); setTool('candidate'); };
  return <div className="min-h-[calc(100vh-72px)] bg-background"><header className="border-b border-border bg-card"><div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="flex items-center gap-3 text-primary"><CirclePlus aria-hidden="true" className="size-5" /><span className="text-[length:var(--text-overline)] font-bold uppercase tracking-widest">{t('admin.tools')}</span></div><h1 className="mt-3 text-[length:var(--text-h1)] font-bold">{t('admin.title')}</h1><p className="mt-2 max-w-2xl text-[length:var(--text-body-lg)] text-muted-foreground">{t('admin.workspace_intro')}</p></div></header><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:px-8"><nav aria-label={t('admin.tools')} className="mb-8 flex gap-2 overflow-x-auto pb-2 lg:mb-0 lg:flex-col">{tools.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTool(id)} aria-current={activeTool === id ? 'page' : undefined} className={`flex min-h-12 shrink-0 items-center gap-3 rounded-md px-4 text-start text-[length:var(--text-label)] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 ${activeTool === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon aria-hidden="true" className="size-4.5" />{label}</button>)}</nav><div>{activeTool === 'residents' && <ResidentRequestsPanel />}{activeTool === 'complaints' && <ComplaintsPanel />}{activeTool === 'shops' && <ShopsPanel />}{activeTool === 'announcement' && <AnnouncementFormPanel />}{activeTool === 'poll' && <PollFormPanel />}{activeTool === 'election' && <ElectionFormPanel onCreated={electionCreated} />}{activeTool === 'candidate' && <CandidateFormPanel electionId={electionId} />}{activeTool === 'team' && <TeamRolesPanel />}{activeTool === 'activity' && <ActivityLogPanel />}{activeTool === 'trash' && <RecycleBinPanel />}</div></main></div>;
}