import { router, useFocusEffect } from "expo-router";
import * as React from "react";

import { useAppSelector } from "@/store";

/**
 * Checkout steps past the cart are meaningless without items. Redirects to the
 * cart (which shows the empty state) while the screen is focused.
 * `skipRef.current === true` disables the guard, e.g. once an order has been
 * placed and the cart was cleared on purpose.
 */
export function useEmptyCartGuard(skipRef?: React.RefObject<boolean>) {
  const count = useAppSelector(s => s.cart.items.length);
  useFocusEffect(
    React.useCallback(() => {
      if (count > 0 || skipRef?.current)
        return;
      router.dismissTo("/checkout/cart");
    }, [count, skipRef]),
  );
}
