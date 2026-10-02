import type { Metadata } from 'next';

import { OrderAuthGuard } from '@/components/app/OrderAuthGuard';
import { OrderHistory } from '@/components/app/OrderHistory';

export const metadata: Metadata = { title: 'الطلبات' };

export default function OrdersPage() {
  return <OrderAuthGuard><OrderHistory /></OrderAuthGuard>;
}