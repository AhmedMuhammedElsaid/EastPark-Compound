import { act, renderHook } from "@testing-library/react-native";

import { closeComingSoon, openComingSoon, useComingSoonState } from "@/lib/coming-soon";
import { useGuestGate } from "@/lib/hooks/use-guest-gate";

let mockIsAuthenticated = false;
const mockPush = jest.fn();

jest.mock("@/store", () => ({
  useAppSelector: jest.fn((selector: (s: { auth: { isAuthenticated: boolean } }) => unknown) =>
    selector({ auth: { isAuthenticated: mockIsAuthenticated } })),
}));
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

beforeEach(() => {
  mockPush.mockReset();
  closeComingSoon();
});

describe("useGuestGate", () => {
  it("opens the Coming soon sheet for a guest instead of running the action", () => {
    mockIsAuthenticated = false;
    const action = jest.fn();
    const { result } = renderHook(() => ({ gate: useGuestGate(), sheet: useComingSoonState() }));

    act(() => result.current.gate.gate(action, "community"));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.gate.isGuest).toBe(true);
    expect(result.current.sheet).toEqual({ visible: true, feature: "community" });
  });

  it("does not navigate for a guest", () => {
    mockIsAuthenticated = false;
    const { result } = renderHook(() => ({ gate: useGuestGate(), sheet: useComingSoonState() }));

    act(() => result.current.gate.gateNavigation("/notifications"));

    expect(mockPush).not.toHaveBeenCalled();
    expect(result.current.sheet.visible).toBe(true);
  });

  it("passes straight through when signed in", () => {
    mockIsAuthenticated = true;
    const action = jest.fn();
    const { result } = renderHook(() => ({ gate: useGuestGate(), sheet: useComingSoonState() }));

    act(() => result.current.gate.gate(action, "market"));
    act(() => result.current.gate.gateNavigation("/(tabs)/orders", "market"));

    expect(action).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/orders");
    expect(result.current.gate.isGuest).toBe(false);
    expect(result.current.sheet.visible).toBe(false);
  });
});

describe("coming soon store", () => {
  it("closes again and keeps the last feature for the exit animation", () => {
    const { result } = renderHook(() => useComingSoonState());

    act(() => openComingSoon("market"));
    expect(result.current).toEqual({ visible: true, feature: "market" });

    act(() => closeComingSoon());
    expect(result.current).toEqual({ visible: false, feature: "market" });
  });
});
