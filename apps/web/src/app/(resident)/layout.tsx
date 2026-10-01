import type { Metadata } from 'next';

import { AppShell } from '@/components/app/AppShell';
import { CartProvider } from '@/lib/cart/CartProvider';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AppShell>{children}</AppShell>
    </CartProvider>
  );
}