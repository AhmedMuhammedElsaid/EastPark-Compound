import type { Metadata } from 'next';

import { OrderAuthGuard } from '@/components/app/OrderAuthGuard';
import { OrderDetail } from '@/components/app/OrderDetail';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderAuthGuard><OrderDetail orderId={id} /></OrderAuthGuard>;
}