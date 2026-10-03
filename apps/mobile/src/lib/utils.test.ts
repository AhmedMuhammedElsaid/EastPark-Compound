import { Linking } from "react-native";

import { openDocument, toNullable } from "@/lib/utils";

describe("utils", () => {
  afterEach(() => jest.restoreAllMocks());

  it("opens a document without calling the error callback", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const onError = jest.fn();
    await openDocument("https://x.test/a.pdf", onError);
    expect(open).toHaveBeenCalledWith("https://x.test/a.pdf");
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a failed open instead of throwing", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
    const onError = jest.fn();
    await expect(openDocument("https://x.test/a.pdf", onError)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("turns empty optional text into null so the backend clears it", () => {
    expect(toNullable("")).toBeNull();
    expect(toNullable("   ")).toBeNull();
    expect(toNullable(undefined)).toBeNull();
    expect(toNullable(" 0100 ")).toBe("0100");
  });
});
