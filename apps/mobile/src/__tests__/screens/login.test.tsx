import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

const mockLogin = jest.fn();
const mockBiometricSignIn = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("react-native-flash-message", () => ({ showMessage: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: jest.fn(() => ({ t: (k: string) => k })) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })) }));
jest.mock("@/components/auth/brand-mark", () => ({ BrandMark: () => null }));
jest.mock("@/services/api/auth", () => ({ authApi: { login: (...a: unknown[]) => mockLogin(...a) } }));
jest.mock("@/services/auth/session", () => ({
  completeLogin: jest.fn(),
  signInWithKeptBiometricSession: () => mockBiometricSignIn(),
}));
jest.mock("@/lib/biometric-binding", () => ({ isBiometricBoundTo: jest.fn(async () => true) }));
jest.mock("@/lib/hooks/use-biometric", () => ({
  useBiometric: jest.fn(() => ({
    ready: true,
    isAvailable: true,
    enabled: true,
    kind: "fingerprint",
    email: "owner@example.com",
    authenticate: () => mockAuthenticate(),
    enable: jest.fn(),
    refresh: jest.fn(),
  })),
}));

const LoginScreen = require("@/app/(auth)/login").default;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function fillValidForm() {
  fireEvent.changeText(screen.getByLabelText("auth.email"), "owner@example.com");
  fireEvent.changeText(screen.getByLabelText("auth.password"), "password123");
}

beforeEach(() => {
  mockLogin.mockReset();
  mockBiometricSignIn.mockReset();
  mockAuthenticate.mockReset();
});

describe("login screen: one sign-in at a time (RW-5d)", () => {
  it("a biometric sign-in in flight blocks the password submit, including the keyboard submit", async () => {
    const prompt = deferred<boolean>();
    mockAuthenticate.mockReturnValue(prompt.promise);
    render(<LoginScreen />);
    await fillValidForm();

    fireEvent.press(screen.getByLabelText("auth.biometric.sign_in_with.fingerprint"));
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalled());

    fireEvent(screen.getByLabelText("auth.password"), "submitEditing");
    fireEvent.press(screen.getByText("auth.login", { exact: true }));
    await act(() => new Promise(r => setTimeout(r, 0)));
    expect(mockLogin).not.toHaveBeenCalled();

    await act(async () => prompt.resolve(false));
  });

  it("a password sign-in in flight blocks the biometric button", async () => {
    const login = deferred<unknown>();
    mockLogin.mockReturnValue(login.promise);
    render(<LoginScreen />);
    await fillValidForm();

    fireEvent(screen.getByLabelText("auth.password"), "submitEditing");
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByLabelText("auth.biometric.sign_in_with.fingerprint"));
    await act(() => new Promise(r => setTimeout(r, 0)));
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockBiometricSignIn).not.toHaveBeenCalled();

    await act(async () => login.resolve({ data: { data: { user: { email: "owner@example.com", role: "RESIDENT" }, accessToken: "a", refreshToken: "r" } } }));
  });
});
