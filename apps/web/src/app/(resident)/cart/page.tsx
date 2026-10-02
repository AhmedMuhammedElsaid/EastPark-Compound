import type { Metadata } from 'next';

import { CartView } from '@/components/app/CartView';

export const metadata: Metadata = { title: 'السلة' };

export default function CartPage() {
  return <CartView />;
}