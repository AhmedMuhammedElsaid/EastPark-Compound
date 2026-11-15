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

  it("shows the empty state and no reversed line when every gross is zero", () => {
    render(<Donut methods={methods.map(m => ({ ...m, gross: "0.00", reversed: "0.00", net: "0.00" }))} />);
    expect(screen.getByLabelText(/finance\.dash\.no_receipts/)).toBeTruthy();
    expect(screen.queryByTestId("donut-reversed")).toBeNull();
  });
});
