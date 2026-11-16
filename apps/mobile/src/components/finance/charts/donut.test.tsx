import { render, screen } from "@testing-library/react-native";
import * as React from "react";

import { Donut } from "./donut";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.net ? `${k}|${o.reversed}|${o.net}` : k), i18n: { language: "en" } }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));

const methods = [
  { method: "CASH", gross: "300.00", reversed: "-50.00", net: "250.00" },
  { method: "BANK_TRANSFER", gross: "100.00", reversed: "0.00", net: "100.00" },
  { method: "INSTAPAY", gross: "0.00", reversed: "0.00", net: "0.00" },
  { method: "CHEQUE", gross: "0.00", reversed: "0.00", net: "0.00" },
] as const;

describe("method donut", () => {
  it("lists gross per method and the reversed line with the net total", () => {
    render(<Donut methods={methods} />);
    expect(screen.getByLabelText("finance.method_CASH: EGP 300")).toBeTruthy();
    expect(screen.getByTestId("donut-reversed").props.children).toBe("finance.dash.reversed_line|EGP -50|EGP 350");
  });

  it("sums reversed and net in whole piasters, so fractional amounts never drift", () => {
    const drift = [
      { method: "CASH", gross: "0.30", reversed: "-0.10", net: "0.20" },
      { method: "BANK_TRANSFER", gross: "0.10", reversed: "-0.20", net: "-0.10" },
      { method: "INSTAPAY", gross: "0.00", reversed: "0.00", net: "0.00" },
      { method: "CHEQUE", gross: "0.00", reversed: "0.00", net: "0.00" },
    ] as const;
    render(<Donut methods={drift} />);
    // floats: -0.1 + -0.2 = -0.30000000000000004 and 0.2 + -0.1 = 0.1 (not 0.10000000000000003)
    expect(screen.getByTestId("donut-reversed").props.children).toBe("finance.dash.reversed_line|EGP -0.3|EGP 0.1");
  });

  it("shows exact one-decimal shares from the decimal strings", () => {
    render(<Donut methods={[{ method: "CASH", gross: "1.00", reversed: "0.00", net: "1.00" }, { method: "BANK_TRANSFER", gross: "2.00", reversed: "0.00", net: "2.00" }, ...methods.slice(2)]} />);
    expect(screen.getByText("66.7%")).toBeTruthy();
    expect(screen.getByText("33.3%")).toBeTruthy();
  });

  it("shows the empty state and no reversed line when every gross is zero", () => {
    render(<Donut methods={methods.map(m => ({ ...m, gross: "0.00", reversed: "0.00", net: "0.00" }))} />);
    expect(screen.getByLabelText(/finance\.dash\.no_receipts/)).toBeTruthy();
    expect(screen.queryByTestId("donut-reversed")).toBeNull();
  });
});
