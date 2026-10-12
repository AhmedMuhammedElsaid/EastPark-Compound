import { Linking } from "react-native";

import { openPrivacyPolicy, openRegisterUnit, PRIVACY_POLICY_URL, REGISTER_UNIT_URL } from "@/lib/web-links";

describe("web links", () => {
  afterEach(() => jest.restoreAllMocks());

  it("points Register your unit at the web unit-registration form", () => {
    expect(REGISTER_UNIT_URL).toBe("https://eastpark-web-app.vercel.app/register-unit");
  });

  it("opens the registration form in the browser", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const onError = jest.fn();

    await openRegisterUnit(onError);

    expect(openURL).toHaveBeenCalledWith("https://eastpark-web-app.vercel.app/register-unit");
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a failure instead of rejecting", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
    const onError = jest.fn();

    await openRegisterUnit(onError);

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("points the privacy policy at the public web page and opens it in the browser", async () => {
    expect(PRIVACY_POLICY_URL).toBe("https://eastpark-web-app.vercel.app/privacy");
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const onError = jest.fn();

    await openPrivacyPolicy(onError);

    expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(onError).not.toHaveBeenCalled();
  });
});
