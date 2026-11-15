import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { makeDashboard } from "../fixtures/finance-dashboard";

const mockPush = jest.fn();
let mockDash: { data?: unknown; isError?: boolean; refetch: jest.Mock } = { refetch: jest.fn() };
let mockAudit: { data?: unknown; isLoading?: boolean; isError?: boolean; refetch: jest.Mock } = { refetch: jest.fn() };
const mockAuditHook = jest.fn((..._a: unknown[]) => mockAudit);

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() } }));
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
    FlashList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.length === 0 ? ListEmptyComponent : data.map((item: unknown, index: number) => <View key={index}>{renderItem({ item, index })}</View>)}
      </View>
    ),
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
});
