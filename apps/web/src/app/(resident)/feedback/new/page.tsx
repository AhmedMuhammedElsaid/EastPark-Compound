import type { Metadata } from 'next';

import { NewFeedbackView } from '@/components/app/FeedbackViews';

export const metadata: Metadata = { title: 'إرسال ملاحظة' };

export default function NewFeedbackPage() {
  return <NewFeedbackView />;
}