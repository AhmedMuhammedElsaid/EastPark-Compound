import * as React from "react";

/** `value`, updated only after it has been stable for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(setDebounced, ms, value);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
