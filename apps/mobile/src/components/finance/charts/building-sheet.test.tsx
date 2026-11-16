import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { BuildingSheet } from "./building-sheet";

// A sheet whose `dismiss()` reports `onDismiss`, like the real modal after its close animation.
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { ScrollView, View } = require("react-native");
  const BottomSheetModal = ({ ref, children, onDismiss }: { ref?: React.Ref<unknown>; children?: React.ReactNode; onDismiss?: () => void }) => {
    React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: () => onDismiss?.() }));
    return <View>{children}</View>;
  };
  return {
    BottomSheetModal,
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: ScrollView,
    useBottomSheetTimingConfigs: () => ({}),
  };
});
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));
jest.mock("@/lib/hooks/use-reduced-motion", () => ({ useReducedMotion: () => true }));
jest.mock("@/lib/format-currency", () => ({ formatCurrency: (n: number) => `EGP ${n}` }));
jest.mock("@/components/finance/finance-ui", () => {
  const { Text } = require("react-native");
  return {
    FinanceFlatRow: ({ flat, onPress }: { flat: { label: string }; onPress: () => void }) => <Text onPress={onPress}>{flat.label}</Text>,
    FinanceFlatRowSkeleton: () => null,
  };
});

const building = { building: "C1", totalFlats: 60, owingFlats: 26, outstanding: "254000.00", floors: [{ floor: "G", totalFlats: 10, owingFlats: 4, outstanding: "9000.00" }, { floor: "1", totalFlats: 10, owingFlats: 5, outstanding: "12000.00" }] };
const flat = { id: "f1", label: "C1-1-2" } as never;

describe("building sheet", () => {
  it("shows the building and owing flats, and routes the taps", () => {
    const onFlatPress = jest.fn();
    const onViewFlats = jest.fn();
    render(<BuildingSheet building={building} flats={[flat]} onFlatPress={onFlatPress} onViewFlats={onViewFlats} onClose={jest.fn()} />);
    expect(screen.getByText("C1")).toBeTruthy();
    expect(screen.getByText("EGP 254000")).toBeTruthy();
    fireEvent.press(screen.getByText("C1-1-2"));
    expect(onFlatPress).toHaveBeenCalledWith(flat);
    fireEvent.press(screen.getByLabelText("finance.dash.view_flats"));
    expect(onViewFlats).toHaveBeenCalledWith("C1");
  });

  it("shows empty and error states for the flats list", () => {
    const { rerender } = render(<BuildingSheet building={building} flats={[]} onFlatPress={jest.fn()} onViewFlats={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText("finance.dash.no_owing_flats")).toBeTruthy();
    const onRetryFlats = jest.fn();
    rerender(<BuildingSheet building={building} flats={undefined} flatsError onRetryFlats={onRetryFlats} onFlatPress={jest.fn()} onViewFlats={jest.fn()} onClose={jest.fn()} />);
    fireEvent.press(screen.getByText("common.retry"));
    expect(onRetryFlats).toHaveBeenCalled();
  });

  it("closes on Android back, consumes the press and stops listening once closed", () => {
    let press: (() => boolean) | undefined;
    const remove = jest.fn();
    const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, cb: () => boolean) => {
      press = cb;
      return { remove };
    }) as never);
    const onClose = jest.fn();
    const { rerender } = render(<BuildingSheet building={building} flats={[]} onFlatPress={jest.fn()} onViewFlats={jest.fn()} onClose={onClose} />);
    expect(spy).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
    let handled = false;
    act(() => {
      handled = press!();
    });
    expect(handled).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<BuildingSheet building={null} flats={[]} onFlatPress={jest.fn()} onViewFlats={jest.fn()} onClose={onClose} />);
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});
