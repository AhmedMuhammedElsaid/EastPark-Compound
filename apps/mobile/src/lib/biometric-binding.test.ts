import {
  isBiometricBoundTo,
  isSameEmail,
  reconcileBiometricForLogin,
} from "@/lib/biometric-binding";
import {
  SECURE_KEY_BIOMETRIC_EMAIL,
  SECURE_KEY_BIOMETRIC_ENABLED,
  SECURE_KEY_REFRESH,
} from "@/services/api/secure-keys";

const mockSecureStore: Record<string, string> = {};
jest.mock("@/lib/secure-storage", () => ({
  getSecureItem: jest.fn(async (k: string) => mockSecureStore[k] ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => {
    mockSecureStore[k] = v;
  }),
  deleteSecureItem: jest.fn(async (k: string) => {
    delete mockSecureStore[k];
  }),
}));

describe("biometric account binding", () => {
  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    mockSecureStore[SECURE_KEY_REFRESH] = "owner-kept-refresh";
    mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED] = "1";
    mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL] = "Owner@Example.com";
  });

  it("compares emails case-insensitively and never matches an empty email", () => {
    expect(isSameEmail(" Owner@Example.com ", "owner@example.com")).toBe(true);
    expect(isSameEmail("owner@example.com", "resident@example.com")).toBe(false);
    expect(isSameEmail(null, null)).toBe(false);
  });

  it("a login by a different account forgets the preference and the kept token", async () => {
    await reconcileBiometricForLogin("resident@example.com");

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
  });

  it("a login by the same account keeps it", async () => {
    await reconcileBiometricForLogin("OWNER@example.com");

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBe("1");
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBe("Owner@Example.com");
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("owner-kept-refresh");
  });

  it("a half-configured preference (no email) is forgotten", async () => {
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL];
    await reconcileBiometricForLogin("owner@example.com");

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
  });

  it("without any preference a login touches nothing", async () => {
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED];
    delete mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL];
    await reconcileBiometricForLogin("resident@example.com");

    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("owner-kept-refresh");
  });

  it("is bound only to the labelled account", async () => {
    await expect(isBiometricBoundTo("owner@example.com")).resolves.toBe(true);
    await expect(isBiometricBoundTo("resident@example.com")).resolves.toBe(false);
    mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED] = "0";
    await expect(isBiometricBoundTo("owner@example.com")).resolves.toBe(false);
  });
});
