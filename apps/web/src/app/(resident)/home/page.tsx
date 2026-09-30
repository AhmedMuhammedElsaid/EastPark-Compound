import type { Metadata } from 'next';

import { ResidentHome } from '@/components/app/ResidentHome';

export const metadata: Metadata = { title: 'Home' };

export default function ResidentHomePage() {
  return <ResidentHome />;
}