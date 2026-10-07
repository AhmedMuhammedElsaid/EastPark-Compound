import {
  clearBiometricPreference,
  forgetKeptBiometricSession,
} from "@/lib/hooks/use-biometric";
import {
  SECURE_KEY_ACCESS,
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

jest.mock("expo-local-authentication", () => ({ AuthenticationType: {} }));

describe("biometric preference", () => {
  beforeEach(() => {
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
    mockSecureStore[SECURE_KEY_ACCESS] = "access";
    mockSecureStore[SECURE_KEY_REFRESH] = "refresh";
    mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED] = "1";
    mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL] = "a@b.c";
  });

  it("turning it off keeps the live session's tokens", async () => {
    await clearBiometricPreference();

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBe("refresh");
    expect(mockSecureStore[SECURE_KEY_ACCESS]).toBe("access");
  });

  it("forgetting a dead kept session also drops its refresh token", async () => {
    await forgetKeptBiometricSession();

    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_ENABLED]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_BIOMETRIC_EMAIL]).toBeUndefined();
    expect(mockSecureStore[SECURE_KEY_REFRESH]).toBeUndefined();
  });
});
