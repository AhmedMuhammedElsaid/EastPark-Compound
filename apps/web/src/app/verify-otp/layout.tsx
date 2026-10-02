import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تأكيد الحساب',
  robots: { index: false, follow: false },
};

export default function VerifyOtpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
