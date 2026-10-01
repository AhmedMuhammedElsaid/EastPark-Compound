import type { Metadata } from 'next';

import { NewFeedbackView } from '@/components/app/FeedbackViews';

export const metadata: Metadata = { title: 'Submit feedback' };

export default function NewFeedbackPage() {
  return <NewFeedbackView />;
}