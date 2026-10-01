import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CheckoutConfirmation } from '@/components/app/CheckoutConfirmation';

export const metadata: Metadata = { title: 'Order placed' };

export default function CheckoutConfirmationPage() {
  return <Suspense><CheckoutConfirmation /></Suspense>;
}