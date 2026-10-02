import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'إعادة تعيين كلمة المرور',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}