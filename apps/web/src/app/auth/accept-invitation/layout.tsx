import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'قبول الدعوة',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function AcceptInvitationLayout({ children }: { children: React.ReactNode }) {
  return children;
}