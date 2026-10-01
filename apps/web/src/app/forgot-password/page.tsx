'use client';

import { AuthFlowShell } from '@/components/auth/AuthFlowShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { useTranslation } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  return <AuthFlowShell title={t('auth.reset_password')} subtitle={t('auth.forgot_password_body')}><ForgotPasswordForm /></AuthFlowShell>;
}