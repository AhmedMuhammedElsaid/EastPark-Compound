import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { HBars } from "./hbars";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));

describe("hbars", () => {
  it("summarises every row for screen readers, negatives included", () => {
    render(<HBars label="By floor" items={[{ key: "G", label: "G", value: 1500 }, { key: "1", label: "1", value: -200 }]} />);
    fireEvent(screen.getByTestId("hbars"), "layout", { nativeEvent: { layout: { width: 300 } } });
    expect(screen.getByLabelText("By floor. G: 1.5K, 1: -200")).toBeTruthy();
  });
});
