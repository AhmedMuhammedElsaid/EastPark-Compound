'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { AuthFlowShell } from '@/components/auth/AuthFlowShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { useTranslation } from '@/lib/i18n';
import { AUTH_TOKEN_PATTERN } from '@/lib/validation/auth';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [token] = useState(() => {
    const value = searchParams.get('token');
    return value && AUTH_TOKEN_PATTERN.test(value) ? value : null;
  });
  const { t } = useTranslation();

  useEffect(() => {
    window.history.replaceState(null, '', '/auth/reset-password');
  }, []);

  return <AuthFlowShell title={t('auth.reset_password')} subtitle={t('auth.choose_new_password')}><ResetPasswordForm token={token} /></AuthFlowShell>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordContent /></Suspense>;
}