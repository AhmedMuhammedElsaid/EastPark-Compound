import type { Metadata } from 'next';

import { ProfileManager } from '@/components/app/ProfileManager';

export const metadata: Metadata = {
  title: 'الملف الشخصي',
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileManager />;
}