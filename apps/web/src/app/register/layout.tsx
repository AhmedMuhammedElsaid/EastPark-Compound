import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'إنشاء حساب',
  description: 'Create your EastPark resident account.',
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
