'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { AcceptInvitationForm } from '@/components/auth/AcceptInvitationForm';
import { AuthFlowShell } from '@/components/auth/AuthFlowShell';
import { useTranslation } from '@/lib/i18n';
import { AUTH_TOKEN_PATTERN } from '@/lib/validation/auth';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const [token] = useState(() => {
    const value = searchParams.get('token');
    return value && AUTH_TOKEN_PATTERN.test(value) ? value : null;
  });
  const { t } = useTranslation();

  useEffect(() => {
    window.history.replaceState(null, '', '/auth/accept-invitation');
  }, []);

  return <AuthFlowShell title={t('auth.accept_invitation')} subtitle={t('auth.complete_setup')}><AcceptInvitationForm token={token} /></AuthFlowShell>;
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={null}><AcceptInvitationContent /></Suspense>;
}