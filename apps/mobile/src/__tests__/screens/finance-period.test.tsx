/* eslint-disable max-lines-per-function -- one describe per screen; the timeline-scroll cases share helpers */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { makeDashboard } from "../fixtures/finance-dashboard";

const mockPush = jest.fn();
let mockDash: { data?: unknown; isError?: boolean; refetch: jest.Mock } = { refetch: jest.fn() };
let mockAudit: { data?: unknown; isFetching?: boolean; isLoading?: boolean; isError?: boolean; refetch: jest.Mock } = { refetch: jest.fn() };
const mockAuditHook = jest.fn((..._a: unknown[]) => mockAudit);

let mockParams: Record<string, string> = {};
const mockScrollToOffset = jest.fn();
let mockContentSize: ((w: number, h: number) => void) | undefined;
let mockFocused = true;
const mockFocusSubs = new Set<() => void>();
let mockMomentum: unknown;
let mockDrag: (() => void) | undefined;
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() }, useLocalSearchParams: () => mockParams, useFocusEffect: (effect: () => void | (() => void)) => {
  const React = require("react");
  const [focused, setFocused] = React.useState(mockFocused);
  React.useEffect(() => {
    const sync = () => setFocused(mockFocused);
    mockFocusSubs.add(sync);
    return () => mockFocusSubs.delete(sync);
  }, []);
  React.useEffect(() => (focused ? effect() : undefined), [focused, effect]);
} }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 0 } }));
jest.mock("phosphor-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: () => require("@/theme/tokens").DARK }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));
jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: ({ right }: { right?: React.ReactNode }) => right ?? null }));
jest.mock("@/components/ui/error-state", () => {
  const { Pressable, Text } = require("react-native");
  return { ErrorState: ({ onRetry }: { onRetry: () => void }) => <Pressable onPress={onRetry}><Text>load-error</Text></Pressable> };
});
jest.mock("@/components/finance/use-refocus-effect", () => ({ useRefocusEffect: () => {} }));
jest.mock("@shopify/flash-list", () => {
  const { View } = require("react-native");
  return {
    FlashList: ({ ref, data, renderItem, ListHeaderComponent, ListEmptyComponent, onContentSizeChange, onScrollBeginDrag, ...props }: any) => {
      mockContentSize = onContentSizeChange;
      mockDrag = onScrollBeginDrag;
      mockMomentum = props.onMomentumScrollBegin;
      require("react").useImperativeHandle(ref, () => ({ scrollToOffset: (...a: unknown[]) => mockScrollToOffset(...a) }));
      return (
        <View>
          {ListHeaderComponent}
          {data.length === 0 ? ListEmptyComponent : data.map((item: unknown, index: number) => <View key={index}>{renderItem({ item, index })}</View>)}
        </View>
      );
    },
  };
});
jest.mock("@/services/api/finance", () => ({
  useFinanceDashboard: () => mockDash,
  useFinanceAudit: (...a: unknown[]) => mockAuditHook(...a),
}));

const FinancePeriod = require("@/app/(finance)/finance/period").default;

const event = (id: string, action: string) => ({ id, action, entity: "Payment", entityId: null, meta: null, createdAt: "2026-11-15T10:20:00.000Z", actor: { id: "u", name: "Sara", role: "ACCOUNTANT" } });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockFocused = true;
  mockDash = { data: makeDashboard(), refetch: jest.fn() };
  mockAudit = { data: { items: [event("e1", "PAYMENT_RECORDED"), event("e2", "NEW_UNKNOWN")], hasMore: false }, refetch: jest.fn() };
});

describe("period close screen", () => {
  it("asks the audit endpoint for the first day of the period up to the as-of date", () => {
    render(<FinancePeriod />);
    expect(mockAuditHook).toHaveBeenLastCalledWith({ from: "2026-11-01", to: "2026-11-15" }, 20, true);
  });

  it("renders the checklist, unapplied payments and a label-mapped timeline", () => {
    render(<FinancePeriod />);
    expect(screen.getByTestId("period-checks")).toBeTruthy();
    expect(screen.getByText("finance.dash.check_unapplied_warn")).toBeTruthy();
    expect(screen.getByText("A2-3-1")).toBeTruthy();
    expect(screen.getByText("finance.dash.audit.PAYMENT_RECORDED")).toBeTruthy();
    expect(screen.getByText("finance.dash.audit_generic")).toBeTruthy();
    expect(screen.queryByText("NEW_UNKNOWN")).toBeNull();
  });

  it("sends Apply to the flat, where the slice 7 apply-credit lives", () => {
    render(<FinancePeriod />);
    fireEvent.press(screen.getAllByText("finance.dash.apply")[0]);
    expect(mockPush).toHaveBeenLastCalledWith("/finance/flats/f1");
  });
});

describe("period close timeline scroll", () => {
  const layoutTimeline = (y: number) => fireEvent(screen.getByTestId("period-timeline-title"), "layout", { nativeEvent: { layout: { x: 0, y, width: 360, height: 40 } } });
  const loaded = { data: { items: [event("e1", "PAYMENT_RECORDED")], hasMore: false }, isLoading: false, refetch: jest.fn() };

  it("opens at the top from the period pill (no section) without scrolling", () => {
    render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 1400));
    expect(mockScrollToOffset).not.toHaveBeenCalled();
  });

  it("scrolls once when the content was laid out during a refetch and the queries then settle with no further size event", () => {
    mockParams = { section: "timeline" };
    mockAudit = { ...loaded, isFetching: true };
    const { rerender } = render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 1400));
    expect(mockScrollToOffset).not.toHaveBeenCalled();
    mockAudit = { ...loaded, isFetching: false };
    rerender(<FinancePeriod />);
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: true });
  });

  it("scrolls when settled and corrects the position once the content grows", () => {
    mockParams = { section: "timeline" };
    mockAudit = { data: undefined, isLoading: true, refetch: jest.fn() };
    const { rerender } = render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 700));
    expect(mockScrollToOffset).not.toHaveBeenCalled();
    mockAudit = loaded;
    rerender(<FinancePeriod />);
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    act(() => mockContentSize?.(360, 1600));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: 640, animated: true });
    act(() => mockContentSize?.(360, 1500));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
  });

  it("stops correcting once the user drags", () => {
    mockParams = { section: "timeline" };
    mockAudit = loaded;
    render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 900));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    act(() => mockDrag?.());
    act(() => mockContentSize?.(360, 2000));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  });

  it("stops correcting when the settling window ends", () => {
    jest.useFakeTimers();
    mockParams = { section: "timeline" };
    mockAudit = loaded;
    render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 900));
    act(() => {
      jest.advanceTimersByTime(1600);
    });
    act(() => mockContentSize?.(360, 2000));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  const setFocus = (value: boolean) => act(() => {
    mockFocused = value;
    mockFocusSubs.forEach(sync => sync());
  });

  it("does not treat momentum events as the user taking over (Android emits them for our own scroll)", () => {
    mockParams = { section: "timeline" };
    mockAudit = loaded;
    render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 900));
    expect(mockMomentum).toBeUndefined();
    act(() => mockContentSize?.(360, 1800));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
  });

  it("blocks attempts while blurred and resumes the pending scroll on refocus", () => {
    mockParams = { section: "timeline" };
    mockAudit = { ...loaded, isFetching: true };
    const { rerender } = render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 1400));
    setFocus(false);
    mockAudit = { ...loaded, isFetching: false };
    rerender(<FinancePeriod />);
    expect(mockScrollToOffset).not.toHaveBeenCalled();
    setFocus(true);
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  });

  it("clears the settling timer on blur and stops correcting", () => {
    jest.useFakeTimers();
    mockParams = { section: "timeline" };
    mockAudit = loaded;
    render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 900));
    expect(jest.getTimerCount()).toBe(1);
    setFocus(false);
    expect(jest.getTimerCount()).toBe(0);
    act(() => mockContentSize?.(360, 2000));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("ends the correction window 1.5 s after the first scroll, however often the content grows", () => {
    jest.useFakeTimers();
    mockParams = { section: "timeline" };
    mockAudit = loaded;
    render(<FinancePeriod />);
    layoutTimeline(640);
    act(() => mockContentSize?.(360, 900));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => mockContentSize?.(360, 1200));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => mockContentSize?.(360, 1500));
    act(() => mockContentSize?.(360, 1800));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it("error, then Retry, then it scrolls", () => {
    mockParams = { section: "timeline" };
    mockDash = { data: undefined, isError: true, refetch: jest.fn() };
    const { rerender } = render(<FinancePeriod />);
    expect(mockScrollToOffset).not.toHaveBeenCalled();
    mockDash = { data: makeDashboard(), refetch: jest.fn() };
    rerender(<FinancePeriod />);
    layoutTimeline(520);
    act(() => mockContentSize?.(360, 1200));
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 520, animated: true });
  });
});

it("shows the flat and amount of a timeline row, not the actor", () => {
  mockAudit = { data: { items: [{ ...event("e9", "PAYMENT_RECORDED"), meta: { flatLabel: "A1-2-3", amount: "1250.00" } }], hasMore: false }, refetch: jest.fn() };
  render(<FinancePeriod />);
  expect(screen.getByText("A1-2-3 · EGP 1250")).toBeTruthy();
  expect(screen.queryByText("Sara")).toBeNull();
});

it("replaces the figures with the error and Retry when a refetch fails after a success", () => {
  const refetch = jest.fn();
  mockDash = { data: makeDashboard(), isError: true, refetch };
  render(<FinancePeriod />);
  expect(screen.queryByTestId("period-checks")).toBeNull();
  fireEvent.press(screen.getByText("load-error"));
  expect(refetch).toHaveBeenCalled();
});

it("shows the empty timeline copy and an error with Retry", () => {
  mockAudit = { data: { items: [], hasMore: false }, refetch: jest.fn() };
  const { unmount } = render(<FinancePeriod />);
  expect(screen.getByText("finance.dash.timeline_empty")).toBeTruthy();
  unmount();
  const refetch = jest.fn();
  mockDash = { data: undefined, isError: true, refetch };
  render(<FinancePeriod />);
  fireEvent.press(screen.getByText("load-error"));
  expect(refetch).toHaveBeenCalled();
});
