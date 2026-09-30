import type { CartItem, Lang, OrderStatus } from '../contracts/index.ts';

export function selectLocalizedValue(
  language: Lang,
  value: string | null | undefined,
  arabicValue: string | null | undefined,
): string {
  if (language === 'ar') {
    return arabicValue?.trim() || value?.trim() || '';
  }

  return value?.trim() || arabicValue?.trim() || '';
}

export function hasCartShopConflict(currentShopId: string | null, nextShopId: string): boolean {
  return currentShopId !== null && currentShopId !== nextShopId;
}

export function calculateCartTotal(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function canResidentCancelOrder(status: OrderStatus): boolean {
  return status === 'PLACED';
}