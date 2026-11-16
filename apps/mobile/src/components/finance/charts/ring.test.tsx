import { render, screen } from "@testing-library/react-native";
import * as React from "react";

import { Ring } from "./ring";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}:${o.rate}` : k), i18n: { language: "en" } }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").LIGHT) }));

describe("ring", () => {
  it("announces the true rate even above 100 percent", () => {
    render(<Ring rate="112.5" />);
    expect(screen.getByLabelText("finance.dash.ring_a11y:112.5%")).toBeTruthy();
  });

  it("shows the empty state when the month has no charges", () => {
    render(<Ring rate={null} />);
    expect(screen.getByLabelText("finance.dash.ring_empty")).toBeTruthy();
  });
});
