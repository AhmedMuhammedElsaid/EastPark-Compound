import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { CompoundMap } from "./compound-map";

const mockSelection = jest.fn();
jest.mock("expo-haptics", () => ({ selectionAsync: (...a: unknown[]) => mockSelection(...a) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o?.code ? `${k}|${o.code}|${o.owing}/${o.total}` : k), i18n: { language: "en" } }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));

const buildings = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"].map((building, i) => ({ building, totalFlats: 40 + i, owingFlats: i, outstanding: `${i * 1000}.00`, floors: [] }));

describe("compound map", () => {
  it("renders one button per building and reports the tapped code", () => {
    const onSelect = jest.fn();
    render(<CompoundMap buildings={buildings} selected="C1" onSelect={onSelect} />);
    fireEvent(screen.getByTestId("compound-map"), "layout", { nativeEvent: { layout: { width: 340 } } });
    expect(screen.getAllByRole("button")).toHaveLength(8);
    fireEvent.press(screen.getByLabelText("finance.dash.building_a11y|C1|4/44"));
    expect(onSelect).toHaveBeenCalledWith("C1");
    expect(mockSelection).toHaveBeenCalled();
    expect(screen.getByLabelText("finance.dash.building_a11y|C1|4/44").props.accessibilityState).toEqual({ selected: true });
  });

  it("shows an empty state without buildings", () => {
    render(<CompoundMap buildings={[]} selected={null} onSelect={jest.fn()} />);
    expect(screen.getByText("finance.dash.no_buildings")).toBeTruthy();
  });
});
