import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useScreenActive } from "./use-screen-active";

let mockFocused = true;
jest.mock("@react-navigation/native", () => ({ useIsFocused: jest.fn(() => mockFocused) }));

describe("useScreenActive", () => {
  let handler: (state: string) => void = () => {};
  const remove = jest.fn();

  beforeEach(() => {
    mockFocused = true;
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: (state: string) => void) => {
      handler = cb;
      return { remove };
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it("is active only while focused and in the foreground", () => {
    const { result, rerender } = renderHook(() => useScreenActive());
    expect(result.current).toBe(true);

    act(() => handler("background"));
    expect(result.current).toBe(false);
    act(() => handler("active"));
    expect(result.current).toBe(true);

    mockFocused = false;
    rerender({});
    expect(result.current).toBe(false);
  });

  it("stops listening on unmount", () => {
    const { unmount } = renderHook(() => useScreenActive());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
