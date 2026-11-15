import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { makeDashboard } from "../fixtures/finance-dashboard";

const mockPush = jest.fn();
let mockDash: { data?: unknown; isError?: boolean; isRefetching?: boolean; isPlaceholderData?: boolean; refetch: jest.Mock } = { refetch: jest.fn() };
const mockFlatsHook = jest.fn((..._a: unknown[]) => ({ data: { pages: [{ data: { data: { items: [{ id: "x", label: "C1-1-1" }] } } }] }, isLoading: false, isError: false, refetch: jest.fn() }));
const mockUseDashboard = jest.fn((months: number) => ({ ...mockDash, months }));

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() } }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o && o.code ? `${k}:${o.code}` : k), i18n: { language: "en" } }) }));
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
jest.mock("@/components/finance/finance-ui", () => ({ OverdueBadge: () => null }));
jest.mock("@shopify/flash-list", () => {
  const { View } = require("react-native");
  return {
    FlashList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.length === 0 ? ListEmptyComponent : data.map((item: unknown, index: number) => <View key={index}>{renderItem({ item, index })}</View>)}
      </View>
    ),
  };
});
jest.mock("@/components/finance/charts/compound-map", () => {
  const { Pressable, Text } = require("react-native");
  return { CompoundMap: ({ onSelect }: { onSelect: (c: string) => void }) => <Pressable onPress={() => onSelect("C1")}><Text>map-C1</Text></Pressable> };
});
jest.mock("@/components/finance/charts/bars-billed-collected", () => {
  const { Pressable, Text } = require("react-native");
  return { BarsBilledCollected: ({ months, onMonthsChange }: any) => <Pressable onPress={() => onMonthsChange(12)}><Text>{`bars-${months}`}</Text></Pressable> };
});
jest.mock("@/components/finance/charts/donut", () => ({ Donut: () => null }));
jest.mock("@/components/finance/charts/stacked-bar", () => ({ StackedBar: () => null }));
jest.mock("@/components/finance/charts/ring", () => ({ Ring: () => null }));
jest.mock("@/components/finance/charts/sparkline", () => ({ Sparkline: () => null }));
jest.mock("@/components/finance/charts/building-sheet", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    BuildingSheet: ({ building, onViewFlats, onClose }: any) => building
      ? (
          <View>
            <Text>{`sheet-${building.building}`}</Text>
            <Pressable onPress={() => onViewFlats(building.building)}><Text>view-flats</Text></Pressable>
            <Pressable onPress={onClose}><Text>close-sheet</Text></Pressable>
          </View>
        )
      : null,
  };
});
jest.mock("@/services/api/finance", () => ({
  useFinanceDashboard: (months: number) => mockUseDashboard(months),
  useFinanceFlats: (...a: unknown[]) => mockFlatsHook(...a),
}));

const FinanceToday = require("@/app/(finance)/finance/today").default;

beforeEach(() => {
  jest.clearAllMocks();
  mockDash = { data: makeDashboard(), refetch: jest.fn() };
});

describe("finance home dashboard", () => {
  it("renders the sections in the mockup order", () => {
    render(<FinanceToday />);
    expect(screen.getByTestId("dash-hero")).toBeTruthy();
    expect(screen.getByTestId("kpi-carousel")).toBeTruthy();
    expect(screen.getByTestId("dash-attention")).toBeTruthy();
    expect(screen.getByTestId("dash-map")).toBeTruthy();
    expect(screen.getByTestId("dash-bars")).toBeTruthy();
    expect(screen.getByTestId("dash-aging")).toBeTruthy();
    expect(screen.getByTestId("dash-methods")).toBeTruthy();
    expect(screen.getByText("finance.dash.top_title")).toBeTruthy();
    expect(screen.getByText("A1-3-5")).toBeTruthy();
    expect(screen.getByText("finance.dash.former_owner")).toBeTruthy();
  });

  it("routes the FAB, bell, period pill and an attention row", () => {
    render(<FinanceToday />);
    fireEvent.press(screen.getByTestId("fab"));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/payment/new");
    fireEvent.press(screen.getByTestId("bell"));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/period");
    fireEvent.press(screen.getByTestId("period-pill"));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/period");
    fireEvent.press(screen.getByTestId("find-flat"));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/flats");
    fireEvent.press(screen.getByLabelText(/finance\.dash\.attn_over90/));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/flats?hasBalance=true&overdueDays=91&sort=balance&asOf=2026-11-15");
    fireEvent.press(screen.getByText("A1-3-5"));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/flats/f9");
  });

  it("opens the building sheet from the map, loads its owing flats and drills down", () => {
    render(<FinanceToday />);
    expect(screen.queryByText("sheet-C1")).toBeNull();
    fireEvent.press(screen.getByText("map-C1"));
    expect(screen.getByText("sheet-C1")).toBeTruthy();
    expect(mockFlatsHook).toHaveBeenLastCalledWith({ building: "C1", hasBalance: true, sort: "balance", asOf: "2026-11-15" }, { enabled: true, limit: 10 });
    fireEvent.press(screen.getByText("view-flats"));
    expect(mockPush).toHaveBeenLastCalledWith("/finance/flats?building=C1&hasBalance=true&sort=balance&asOf=2026-11-15");
    fireEvent.press(screen.getByText("close-sheet"));
    expect(screen.queryByText("sheet-C1")).toBeNull();
  });

  it("switches the chart window through the endpoint months parameter", () => {
    render(<FinanceToday />);
    expect(screen.getByText("bars-6")).toBeTruthy();
    fireEvent.press(screen.getByText("bars-6"));
    expect(mockUseDashboard).toHaveBeenLastCalledWith(12);
    expect(screen.getByText("bars-12")).toBeTruthy();
  });

  it("shows a skeleton while loading and an error with Retry, never stale figures", () => {
    mockDash = { data: undefined, refetch: jest.fn() };
    const { unmount } = render(<FinanceToday />);
    expect(screen.getByTestId("dashboard-skeleton", { hidden: true })).toBeTruthy();
    unmount();
    const refetch = jest.fn();
    mockDash = { data: undefined, isError: true, refetch };
    render(<FinanceToday />);
    fireEvent.press(screen.getByText("load-error"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty copy when nobody is overdue", () => {
    mockDash = { data: makeDashboard({ topOwing: [], cohort: { charges: "0.00", allocated: "0.00", open: "0.00", rate: null } }), refetch: jest.fn() };
    render(<FinanceToday />);
    expect(screen.getByText("finance.dash.no_overdue")).toBeTruthy();
  });
});
