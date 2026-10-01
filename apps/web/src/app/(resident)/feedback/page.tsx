import type { Metadata } from 'next';

import { FeedbackListView } from '@/components/app/FeedbackViews';

export const metadata: Metadata = { title: 'Feedback' };

export default function FeedbackPage() {
  return <FeedbackListView />;
}