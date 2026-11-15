import { render, screen } from "@testing-library/react-native";
import * as React from "react";

let mockParams: Record<string, string> = {};
const mockHook = jest.fn((..._a: unknown[]) => ({ data: { pages: [] }, isLoading: false, isError: false, refetch: jest.fn(), fetchNextPage: jest.fn() }));

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => mockParams }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("phosphor-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: () => require("@/theme/tokens").DARK }));
jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/components/ui/error-state", () => ({ ErrorState: () => null }));
jest.mock("@/components/finance/finance-ui", () => ({ FinanceFlatRow: () => null, FinanceFlatRowSkeleton: () => null }));
jest.mock("@/components/finance/use-debounced", () => ({ useDebounced: (v: unknown) => v }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));
jest.mock("@shopify/flash-list", () => ({ FlashList: () => null }));
jest.mock("@/services/api/finance", () => ({ useFinanceFlats: (...a: unknown[]) => mockHook(...a) }));

const FlatsScreen = require("@/app/(finance)/finance/flats/index").default;

describe("flats list route parameters (dashboard drilldowns)", () => {
  it("reads building, hasBalance, overdueDays, sort and asOf", () => {
    mockParams = { building: "c1", hasBalance: "true", overdueDays: "91", sort: "balance", asOf: "2026-11-15" };
    render(<FlatsScreen />);
    expect(mockHook).toHaveBeenLastCalledWith({ q: undefined, building: "C1", hasBalance: true, overdueDays: 91, sort: "balance", asOf: "2026-11-15" });
    expect(screen.getByTestId("building-chip")).toBeTruthy();
  });

  it("ignores malformed values and keeps the plain list otherwise", () => {
    mockParams = { overdueDays: "abc", sort: "id", asOf: "yesterday" };
    render(<FlatsScreen />);
    expect(mockHook).toHaveBeenLastCalledWith({ q: undefined, building: undefined, hasBalance: undefined, overdueDays: undefined, sort: undefined, asOf: undefined });
  });
});
