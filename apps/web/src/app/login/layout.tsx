import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'Sign in securely to your EastPark resident account.',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
