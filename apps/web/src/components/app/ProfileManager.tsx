'use client';

import type { ProfileFormInput } from '@/lib/validation/profile';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Globe2, LogOut, Moon, ShieldCheck, Sun, Trash2, Upload, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/Button';
import { Container } from '@/components/Container';
import { parseUploadResult } from '@/lib/api/feedback';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { profileFormSchema } from '@/lib/validation/profile';

const fieldClass =
  'min-h-12 w-full rounded-md border border-input bg-background px-4 text-[length:var(--text-body-lg)] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Vercel rejects request bodies over 4.5 MB; stay under it with room for multipart overhead.
const MAX_AVATAR_SIZE = 4 * 1024 * 1024;

export function ProfileManager() {
  const router = useRouter();
  const { isLoading, logout, refreshUser, user } = useAuth();
  const { lang, setLang, t } = useTranslation();
  const { setTheme, theme } = useTheme();
  const [submitState, setSubmitState] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteValue, setDeleteValue] = React.useState('');
  const [deleteError, setDeleteError] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [avatarInputKey, setAvatarInputKey] = React.useState(0);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormInput>({ resolver: zodResolver(profileFormSchema) });
  const savedAvatarUrl = useWatch({ control, name: 'avatarUrl' });

  React.useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, router, user]);

  React.useEffect(() => {
    if (!user) return;
    reset({
      name: user.name,
      phone: user.phone ?? '',
      unitNumber: user.unitNumber ?? '',
      avatarUrl: user.avatarUrl ?? '',
    });
  }, [reset, user]);

  React.useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState('idle');
    setAvatarError(null);
    try {
      let avatarUrl = values.avatarUrl;
      if (avatarFile) {
        const formData = new FormData();
        formData.set('file', avatarFile, avatarFile.name);
        const upload = await fetch('/api/uploads/image?purpose=avatar', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(20_000),
        });
        if (!upload.ok) throw new Error('avatar_upload');
        avatarUrl = parseUploadResult(await upload.json()).url;
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, avatarUrl }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Profile update failed');
      const updated = await refreshUser();
      if (!updated) throw new Error('Profile refresh failed');
      reset({
        name: updated.name,
        phone: updated.phone ?? '',
        unitNumber: updated.unitNumber ?? '',
        avatarUrl: updated.avatarUrl ?? '',
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarInputKey((key) => key + 1);
      setSubmitState('success');
    } catch (error) {
      if (error instanceof Error && error.message === 'avatar_upload') {
        setAvatarError(t('profile.avatar_upload_error'));
      } else {
        setSubmitState('error');
      }
    }
  });

  function selectAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubmitState('idle');
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarError(t('profile.avatar_type_error'));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarError(t('profile.avatar_size_error'));
      event.target.value = '';
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function removeAvatar() {
    setSubmitState('idle');
    setAvatarError(null);
    setAvatarFile(null);
    setAvatarPreview(null);
    setValue('avatarUrl', '', { shouldDirty: true, shouldValidate: true });
    setAvatarInputKey((key) => key + 1);
  }

  const canDelete = user?.role === 'RESIDENT' || user?.role === 'MERCHANT';
  const confirmWord = t('profile.delete_confirm_word');

  async function deleteAccount() {
    if (deleteValue.trim() !== confirmWord) return;
    setIsDeleting(true);
    setDeleteError(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'DELETE',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Account deletion failed');
      await logout({ redirectTo: '/' });
    } catch {
      setDeleteError(true);
      setIsDeleting(false);
    }
  }

  if (isLoading || !user) {
    return (
      <Container className="py-12">
        <div role="status" aria-live="polite" className="mx-auto max-w-4xl space-y-4">
          <span className="sr-only">{t('common.loading')}</span>
          <div className="h-8 w-48 animate-pulse rounded-sm bg-muted motion-reduce:animate-none" />
          <div className="h-52 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </div>
      </Container>
    );
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const displayedAvatar = avatarPreview ?? savedAvatarUrl;

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[length:var(--text-overline)] font-bold uppercase text-primary">{t('profile.account')}</p>
            <h1 className="mt-2 text-[length:var(--text-h1)] font-bold text-foreground">{t('profile.title')}</h1>
            <p className="mt-2 max-w-2xl text-[length:var(--text-body)] text-muted-foreground">{t('profile.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-muted bg-cover bg-center text-[length:var(--text-body-lg)] font-bold text-primary"
              style={displayedAvatar ? { backgroundImage: `url(${JSON.stringify(displayedAvatar)})` } : undefined}
            >
              {!displayedAvatar && (initials || <UserRound className="size-6" />)}
            </span>
            <div>
              <p className="font-bold text-foreground">{user.name}</p>
              <p className="text-[length:var(--text-caption)] font-semibold text-primary">{t(`profile.roles.${user.role.toLowerCase()}`)}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] lg:gap-14">
          <section aria-labelledby="profile-details-title">
            <h2 id="profile-details-title" className="text-[length:var(--text-h2)] font-bold text-foreground">{t('profile.personal_details')}</h2>
            <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
              <ProfileField id="profile-name" label={t('auth.name')} error={errors.name?.message && t(errors.name.message)}>
                <input id="profile-name" autoComplete="name" className={fieldClass} aria-invalid={Boolean(errors.name)} {...register('name')} />
              </ProfileField>
              <ProfileField id="profile-email" label={t('auth.email')}>
                <input id="profile-email" type="email" dir="ltr" value={user.email} disabled className={fieldClass} />
              </ProfileField>
              <ProfileField id="profile-phone" label={t('auth.phone')} error={errors.phone?.message && t(errors.phone.message)}>
                <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" className={fieldClass} aria-invalid={Boolean(errors.phone)} placeholder="+201234567890" {...register('phone')} />
              </ProfileField>
              <ProfileField id="profile-unit" label={t('auth.unit_number')} error={errors.unitNumber?.message && t(errors.unitNumber.message)}>
                <input id="profile-unit" autoComplete="off" className={fieldClass} aria-invalid={Boolean(errors.unitNumber)} {...register('unitNumber')} />
              </ProfileField>
              <div className="sm:col-span-2">
                <ProfileField id="profile-avatar" label={t('profile.avatar')} hint={t('profile.avatar_hint')} error={avatarError ?? (errors.avatarUrl?.message && t(errors.avatarUrl.message))}>
                  <input type="hidden" {...register('avatarUrl')} />
                  <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/35 p-4 min-[420px]:flex-row min-[420px]:items-center">
                    <span
                      aria-hidden="true"
                      className="flex size-20 shrink-0 items-center justify-center rounded-full bg-muted bg-cover bg-center text-[length:var(--text-h2)] font-bold text-primary"
                      style={displayedAvatar ? { backgroundImage: `url(${JSON.stringify(displayedAvatar)})` } : undefined}
                    >
                      {!displayedAvatar && (initials || <UserRound className="size-7" />)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <input
                        key={avatarInputKey}
                        id="profile-avatar"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={selectAvatar}
                        className="peer sr-only"
                        aria-describedby="profile-avatar-hint"
                      />
                      <label htmlFor="profile-avatar" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-[length:var(--text-label)] font-bold text-foreground hover:bg-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-500">
                        <Upload aria-hidden="true" className="size-4.5" />
                        {displayedAvatar ? t('profile.change_photo') : t('profile.choose_photo')}
                      </label>
                      {displayedAvatar && (
                        <button type="button" onClick={removeAvatar} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-[length:var(--text-label)] font-bold text-error hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error">
                          <Trash2 aria-hidden="true" className="size-4.5" />
                          {t('profile.remove_photo')}
                        </button>
                      )}
                    </div>
                  </div>
                </ProfileField>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:col-span-2 sm:flex-row sm:items-center">
                <Button type="submit" disabled={(!isDirty && !avatarFile) || isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? t('common.loading') : t('profile.save_changes')}
                </Button>
                {submitState === 'success' && <p role="status" className="flex items-center gap-2 text-[length:var(--text-body)] text-success"><Check aria-hidden="true" className="size-4" />{t('profile.saved')}</p>}
                {submitState === 'error' && <p role="alert" className="text-[length:var(--text-body)] text-error">{t('profile.save_error')}</p>}
              </div>
            </form>
          </section>

          <aside className="space-y-8">
            <section aria-labelledby="preferences-title">
              <h2 id="preferences-title" className="text-[length:var(--text-h2)] font-bold text-foreground">{t('profile.preferences')}</h2>
              <div className="mt-5 space-y-5">
                <PreferenceGroup icon={<Globe2 className="size-5" />} label={t('profile.language')}>
                  <SegmentedControl value={lang} options={[{ value: 'ar', label: t('profile.arabic') }, { value: 'en', label: t('profile.english') }]} onChange={(value) => setLang(value as 'ar' | 'en')} />
                </PreferenceGroup>
                <PreferenceGroup icon={theme === 'dark' ? <Moon className="size-5" /> : <Sun className="size-5" />} label={t('profile.theme')}>
                  <SegmentedControl value={theme} options={[{ value: 'dark', label: t('profile.dark') }, { value: 'light', label: t('profile.light') }]} onChange={(value) => setTheme(value as 'dark' | 'light')} />
                </PreferenceGroup>
              </div>
              <p className="mt-4 text-[length:var(--text-caption)] leading-5 text-muted-foreground">{t('profile.preferences_local')}</p>
            </section>

            <section aria-labelledby="session-title" className="border-t border-border pt-7">
              <h2 id="session-title" className="text-[length:var(--text-h2)] font-bold text-foreground">{t('profile.security')}</h2>
              <button type="button" onClick={() => void logout()} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-border px-4 text-[length:var(--text-button)] font-bold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500">
                <LogOut aria-hidden="true" className="size-4.5" />{t('auth.logout')}
              </button>
            </section>
          </aside>
        </div>

        <section aria-labelledby="danger-title" className="border-t border-border py-8">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="max-w-2xl">
              <h2 id="danger-title" className="text-[length:var(--text-h2)] font-bold text-foreground">{t('profile.account_controls')}</h2>
              <p className="mt-2 text-[length:var(--text-body)] text-muted-foreground">{canDelete ? t('profile.delete_account_confirm') : t('profile.delete_unavailable')}</p>
            </div>
          </div>

          {canDelete && (!deleteOpen ? (
            <button type="button" onClick={() => setDeleteOpen(true)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-md border border-error px-5 text-[length:var(--text-button)] font-bold text-error hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error">
              <Trash2 aria-hidden="true" className="size-4.5" />{t('profile.delete_account_button')}
            </button>
          ) : (
            <div className="mt-6 max-w-xl rounded-md border border-error/50 bg-error/8 p-5">
              <label htmlFor="delete-confirm" className="block text-[length:var(--text-body)] font-semibold text-foreground">{t('profile.delete_type_prompt', { word: confirmWord })}</label>
              <input id="delete-confirm" value={deleteValue} onChange={(event) => setDeleteValue(event.target.value)} autoComplete="off" className={`${fieldClass} mt-3`} />
              {deleteError && <p role="alert" className="mt-3 text-[length:var(--text-body)] text-error">{t('profile.delete_account_error')}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void deleteAccount()} disabled={deleteValue.trim() !== confirmWord || isDeleting} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-error px-5 text-[length:var(--text-button)] font-bold text-error-foreground disabled:cursor-not-allowed disabled:opacity-40">
                  <Trash2 aria-hidden="true" className="size-4.5" />{isDeleting ? t('common.loading') : t('profile.delete_account_button')}
                </button>
                <button type="button" onClick={() => { setDeleteOpen(false); setDeleteValue(''); setDeleteError(false); }} className="min-h-12 rounded-md px-5 text-[length:var(--text-button)] font-bold text-muted-foreground hover:bg-muted">{t('common.cancel')}</button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </Container>
  );
}

function ProfileField({ children, error, hint, id, label }: { children: React.ReactNode; error?: string; hint?: string; id: string; label: string }) {
  return <div><label htmlFor={id} className="mb-2 block text-[length:var(--text-label)] font-semibold text-foreground">{label}</label>{children}{hint && !error && <p id={`${id}-hint`} className="mt-2 text-[length:var(--text-caption)] text-muted-foreground">{hint}</p>}{error && <p role="alert" className="mt-2 text-[length:var(--text-caption)] text-error">{error}</p>}</div>;
}

function PreferenceGroup({ children, icon, label }: { children: React.ReactNode; icon: React.ReactNode; label: string }) {
  return <div><div className="mb-2 flex items-center gap-2 text-[length:var(--text-label)] font-semibold text-foreground"><span aria-hidden="true" className="text-primary">{icon}</span>{label}</div>{children}</div>;
}

function SegmentedControl({ onChange, options, value }: { onChange: (value: string) => void; options: { label: string; value: string }[]; value: string }) {
  return <div className="grid grid-cols-2 rounded-md border border-border bg-muted p-1">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`min-h-11 rounded-sm px-3 text-[length:var(--text-label)] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-gold-500 ${value === option.value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{option.label}</button>)}</div>;
}