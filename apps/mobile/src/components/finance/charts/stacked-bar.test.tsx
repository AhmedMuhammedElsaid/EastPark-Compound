import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { StackedBar } from "./stacked-bar";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").LIGHT) }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));

describe("aging stacked bar", () => {
  it("lists the four buckets with the accepted labels", () => {
    render(<StackedBar aging={{ current: "100.00", d31_60: "50.00", d61_90: "0.00", over90: "25.00" }} />);
    fireEvent(screen.getByTestId("stacked-bar"), "layout", { nativeEvent: { layout: { width: 300 } } });
    expect(screen.getByLabelText("finance.dash.aging_current: EGP 100")).toBeTruthy();
    expect(screen.getByLabelText("finance.dash.aging_over_90: EGP 25")).toBeTruthy();
  });

  it("shows the no-overdue state when everything is zero", () => {
    render(<StackedBar aging={{ current: "0.00", d31_60: "0.00", d61_90: "0.00", over90: "0.00" }} />);
    expect(screen.getAllByText("finance.dash.no_overdue").length).toBeGreaterThan(0);
  });
});
