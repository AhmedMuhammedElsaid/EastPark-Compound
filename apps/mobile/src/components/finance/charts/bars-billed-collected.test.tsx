import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { BarsBilledCollected } from "./bars-billed-collected";

const mockSelection = jest.fn();
jest.mock("expo-haptics", () => ({ selectionAsync: (...a: unknown[]) => mockSelection(...a) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.rate ? `${k}|${o.billed}|${o.collected}|${o.rate}` : k), i18n: { language: "en" } }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));

const billed = [{ period: "2026-10", amount: "1000.00" }, { period: "2026-11", amount: "-200.00" }];
const collected = [{ period: "2026-10", amount: "800.00" }, { period: "2026-11", amount: "0.00" }];

function layoutChart() {
  fireEvent(screen.getByTestId("bars-chart"), "layout", { nativeEvent: { layout: { width: 320 } } });
}

describe("billed vs collected bars", () => {
  beforeEach(() => mockSelection.mockClear());

  it("switches range with haptics and selects a month to read it out", () => {
    const onMonthsChange = jest.fn();
    render(<BarsBilledCollected billed={billed} collected={collected} months={6} onMonthsChange={onMonthsChange} />);
    layoutChart();
    fireEvent.press(screen.getByLabelText("finance.dash.months_12_a11y"));
    expect(onMonthsChange).toHaveBeenCalledWith(12);
    expect(mockSelection).toHaveBeenCalled();

    const columns = screen.getAllByRole("button");
    fireEvent.press(columns[0]);
    expect(screen.getByText(/finance\.dash\.month_readout\|EGP 1000\|EGP 800\|80%/)).toBeTruthy();
  });

  it("handles a negative month and shows no rate when nothing was billed", () => {
    render(<BarsBilledCollected billed={billed} collected={collected} months={6} onMonthsChange={jest.fn()} />);
    layoutChart();
    fireEvent.press(screen.getAllByRole("button")[1]);
    expect(screen.getByText(/EGP -200\|EGP 0\|—/)).toBeTruthy();
  });

  it("shows the empty state for an all-zero series", () => {
    const zero = billed.map(b => ({ ...b, amount: "0.00" }));
    render(<BarsBilledCollected billed={zero} collected={zero} months={6} onMonthsChange={jest.fn()} />);
    layoutChart();
    expect(screen.getAllByText("finance.dash.no_data").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
