import { Linking } from "react-native";

import { openPrivacyPolicy, PRIVACY_POLICY_URL } from "@/lib/web-links";

describe("web links", () => {
  afterEach(() => jest.restoreAllMocks());

  it("points the privacy policy at the public web page and opens it in the browser", async () => {
    expect(PRIVACY_POLICY_URL).toBe("https://eastpark-web-app.vercel.app/privacy");
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const onError = jest.fn();

    await openPrivacyPolicy(onError);

    expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(onError).not.toHaveBeenCalled();
  });
});
