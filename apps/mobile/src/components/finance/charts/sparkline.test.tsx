import { render, screen } from "@testing-library/react-native";
import * as React from "react";

import { Sparkline } from "./sparkline";

jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));

describe("sparkline", () => {
  it("renders decorative geometry from decimal strings", () => {
    render(<Sparkline values={["10.00", "12.50", "-3.00"]} color="c3" />);
    expect(screen.getByTestId("sparkline", { includeHiddenElements: true })).toBeTruthy();
  });

  it("renders nothing for an empty series", () => {
    render(<Sparkline values={[]} />);
    expect(screen.queryByTestId("sparkline", { includeHiddenElements: true })).toBeNull();
  });
});
