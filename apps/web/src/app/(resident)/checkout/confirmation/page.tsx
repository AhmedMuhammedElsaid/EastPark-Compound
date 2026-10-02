import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CheckoutConfirmation } from '@/components/app/CheckoutConfirmation';

export const metadata: Metadata = { title: 'تم تقديم الطلب' };

export default function CheckoutConfirmationPage() {
  return <Suspense><CheckoutConfirmation /></Suspense>;
}