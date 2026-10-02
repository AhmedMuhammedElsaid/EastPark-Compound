import type { Metadata } from 'next';

import { FeedbackDetailView } from '@/components/app/FeedbackViews';

export const metadata: Metadata = { title: 'تفاصيل الملاحظة' };

type FeedbackDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function FeedbackDetailPage({ params, searchParams }: FeedbackDetailPageProps) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  return <FeedbackDetailView id={id} created={created === '1'} />;
}