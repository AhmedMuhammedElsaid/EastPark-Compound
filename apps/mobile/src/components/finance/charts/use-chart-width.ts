import * as React from "react";

/** Measured width of the chart container (0 until the first layout pass); `fallback` is used when given and unmeasured. */
export function useChartWidth(fallback = 0) {
  const [width, setWidth] = React.useState(fallback);
  const onLayout = React.useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    setWidth(prev => (prev === next ? prev : next));
  }, []);
  return { width, onLayout };
}
