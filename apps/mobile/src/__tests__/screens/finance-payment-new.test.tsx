import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

let mockUnconfirmed = false;
let mockPending: { key: string; body: { flatId: string } } | null = null;
const mockSubmit = jest.fn();
const mockRetry = jest.fn();
const mockDiscard = jest.fn();
const mockReset = jest.fn();
const mockAddListener = jest.fn((_event: string, _listener: (e: unknown) => void) => jest.fn());
const mockDispatch = jest.fn();
const mockShowConfirm = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ flatId: "flat_A1-3-2" }),
  useNavigation: () => ({ addListener: mockAddListener, dispatch: mockDispatch }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("react-native-flash-message", () => ({ showMessage: jest.fn() }));
jest.mock("phosphor-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/components/finance/finance-ui", () => ({ FinanceFlatRow: () => null, FinanceFlatRowSkeleton: () => null }));
jest.mock("@/components/finance/payment-receipt", () => ({ PaymentReceipt: () => null }));
jest.mock("@/components/auth/gold-button", () => {
  const R = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    GoldButton: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
      R.createElement(Pressable, { onPress, disabled, accessibilityRole: "button", accessibilityLabel: label }, R.createElement(Text, null, label)),
  };
});
jest.mock("@/lib/hooks/use-app-colors", () => {
  const { DARK } = require("@/theme/tokens");
  return { useAppColors: () => DARK };
});
jest.mock("@/lib/confirm-dialog", () => ({ showConfirm: (...a: unknown[]) => mockShowConfirm(...a) }));
jest.mock("@/services/api/finance", () => ({
  FINANCE_PAYMENT_METHODS: ["CASH", "BANK_TRANSFER", "INSTAPAY", "CHEQUE"],
  useFinanceFlat: () => ({ data: { id: "flat_A1-3-2", label: "A1-3-2", owner: { name: "Sara" }, balance: 900 }, isLoading: false }),
  useFinanceFlats: () => ({ data: undefined, isLoading: false }),
}));
jest.mock("@/components/finance/use-payment-submission", () => ({
  SlipUploadError: class SlipUploadError extends Error {},
  usePaymentSubmission: () => ({
    isPending: false,
    data: undefined,
    unconfirmed: mockUnconfirmed,
    pending: () => mockPending,
    submit: mockSubmit,
    retry: mockRetry,
    discard: mockDiscard,
    reset: mockReset,
  }),
}));

const NewPaymentScreen = require("@/app/(finance)/finance/payment/new").default;

const networkError = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });

beforeEach(() => {
  mockUnconfirmed = false;
  mockPending = null;
  jest.clearAllMocks();
  // A request that never gets an answer: the hook turns unconfirmed.
  mockSubmit.mockImplementation((_submission, options: { onError: (e: unknown) => void }) => {
    mockUnconfirmed = true;
    mockPending = { key: "pay-1", body: { flatId: "flat_A1-3-2" } };
    options.onError(networkError);
  });
});

function recordUnconfirmed() {
  render(<NewPaymentScreen />);
  fireEvent.changeText(screen.getByLabelText("finance.amount"), "450");
  fireEvent.press(screen.getByLabelText("finance.record_payment"));
}

describe("record payment: unconfirmed attempt", () => {
  it("keeps the form editable before anything is sent", () => {
    render(<NewPaymentScreen />);
    expect(screen.getByLabelText("finance.amount").props.editable).toBe(true);
    expect(screen.getByLabelText("finance.yesterday").props.accessibilityState.disabled).toBe(false);
  });

  it("locks every field while the payment is unconfirmed", () => {
    recordUnconfirmed();

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText("finance.retry_safe")).toBeTruthy();
    expect(screen.getByLabelText("finance.amount").props.editable).toBe(false);
    expect(screen.getByLabelText("finance.note").props.editable).toBe(false);
    for (const label of ["finance.yesterday", "finance.method_BANK_TRANSFER", "finance.pay_for_DEPOSIT", "finance.change_flat"])
      expect(screen.getByLabelText(label).props.accessibilityState.disabled).toBe(true);
  });

  it("try again re-sends the stored request instead of rebuilding it", () => {
    recordUnconfirmed();

    fireEvent.press(screen.getByLabelText("finance.try_again"));

    expect(mockRetry).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("discard and edit asks to check the recent payments before unlocking", async () => {
    recordUnconfirmed();
    mockShowConfirm.mockResolvedValueOnce(false);

    fireEvent.press(screen.getByLabelText("finance.discard_and_edit"));
    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalledTimes(1));
    expect(mockShowConfirm).toHaveBeenCalledWith(expect.objectContaining({ message: "finance.discard_unconfirmed_body" }));
    expect(mockDiscard).not.toHaveBeenCalled();

    mockShowConfirm.mockResolvedValueOnce(true);
    fireEvent.press(screen.getByLabelText("finance.discard_and_edit"));
    await waitFor(() => expect(mockDiscard).toHaveBeenCalledTimes(1));
  });

  it("warns before leaving the screen while unconfirmed", async () => {
    recordUnconfirmed();
    const call = mockAddListener.mock.calls.find(([event]) => event === "beforeRemove");
    expect(call).toBeTruthy();

    mockShowConfirm.mockResolvedValueOnce(true);
    const event = { preventDefault: jest.fn(), data: { action: { type: "GO_BACK" } } };
    await act(async () => {
      call![1](event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockShowConfirm).toHaveBeenCalledWith(expect.objectContaining({ message: "finance.leave_unconfirmed_body" }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
  });

  it("start a new payment after an idempotency conflict warns to check recent payments first", async () => {
    mockSubmit.mockImplementation((_submission, options: { onError: (e: unknown) => void }) => {
      options.onError({ response: { status: 409, data: { message: "finance.error.idempotencyConflict" } } });
    });
    recordUnconfirmed();
    mockShowConfirm.mockResolvedValueOnce(false);

    fireEvent.press(screen.getByLabelText("finance.start_new_payment"));
    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalledTimes(1));
    expect(mockShowConfirm).toHaveBeenCalledWith(expect.objectContaining({ message: "finance.start_new_body" }));
    expect(mockReset).not.toHaveBeenCalled();
    expect(screen.getByLabelText("finance.amount").props.editable).toBe(false);
  });
});
