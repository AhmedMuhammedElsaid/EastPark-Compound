import { renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { getOriginRoute, useOriginBack } from "./use-origin-back";

const mockRouter = { back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: { from?: string } = {};
jest.mock("expo-router", () => ({
  router: {
    back: () => mockRouter.back(),
    navigate: (...a: unknown[]) => mockRouter.navigate(...a),
    canGoBack: () => mockRouter.canGoBack(),
  },
  useLocalSearchParams: () => mockParams,
  // Run the effect once on mount, like a focused screen.
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import("react")>("react").useEffect(effect, [effect]),
}));

describe("getOriginRoute", () => {
  it("maps known origins to their tab route", () => {
    expect(getOriginRoute("home")).toBe("/(tabs)");
    expect(getOriginRoute("profile")).toBe("/(tabs)/profile");
  });

  it("takes the first value of a repeated param", () => {
    expect(getOriginRoute(["home", "profile"])).toBe("/(tabs)");
  });

  it("ignores missing and unknown origins", () => {
    expect(getOriginRoute(undefined)).toBeUndefined();
    expect(getOriginRoute("elsewhere")).toBeUndefined();
    expect(getOriginRoute("toString")).toBeUndefined();
  });
});

describe("useOriginBack", () => {
  let hardwareHandler: () => boolean = () => false;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockRouter.canGoBack.mockReturnValue(true);
    jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, cb: () => boolean) => {
      hardwareHandler = cb;
      return { remove };
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it("has no handler and leaves hardware Back alone without ?from= or a fallback", () => {
    const { result } = renderHook(() => useOriginBack());
    expect(result.current).toBeUndefined();
    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  it("pops first, then navigates to the ?from= origin (default behaviour)", () => {
    mockParams = { from: "home" };
    const { result } = renderHook(() => useOriginBack());
    result.current?.();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)");
    expect(hardwareHandler()).toBe(true);
  });

  it("with a fallback it always returns a handler and takes over hardware Back", () => {
    const { result } = renderHook(() => useOriginBack({ fallback: "profile" }));
    expect(result.current).toBeDefined();
    expect(BackHandler.addEventListener).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
    expect(hardwareHandler()).toBe(true);
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)/profile");
  });

  it("?from= wins over the fallback", () => {
    mockParams = { from: "home" };
    const { result } = renderHook(() => useOriginBack({ fallback: "profile" }));
    result.current?.();
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)");
  });

  it("popFirst: false skips router.back()", () => {
    const { result } = renderHook(() => useOriginBack({ fallback: "profile", popFirst: false }));
    result.current?.();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(tabs)/profile");
  });

  it("removes the hardware listener on unmount", () => {
    const { unmount } = renderHook(() => useOriginBack({ fallback: "profile" }));
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
