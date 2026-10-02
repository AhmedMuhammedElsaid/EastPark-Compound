import type { Metadata } from 'next';

import { FeedbackListView } from '@/components/app/FeedbackViews';

export const metadata: Metadata = { title: 'الملاحظات' };

export default function FeedbackPage() {
  return <FeedbackListView />;
}