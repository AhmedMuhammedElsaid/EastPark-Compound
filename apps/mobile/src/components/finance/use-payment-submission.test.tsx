import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { usePaymentSubmission } from "./use-payment-submission";

// Flush query notifications synchronously so every state update lands inside act().
notifyManager.setScheduler(callback => callback());

const mockCreatePayment = jest.fn();
const mockUploadSlip = jest.fn();
jest.mock("@/services/api/finance", () => ({
  financeApi: {
    createPayment: (...a: unknown[]) => mockCreatePayment(...a),
    uploadSlip: (...a: unknown[]) => mockUploadSlip(...a),
  },
}));

const input = { flatId: "flat_A1-3-2", amount: "450.00", method: "CASH" as const, receivedAt: "2026-11-02" };
const receipt = { data: { data: { id: "p1", receiptNo: "R-2026-000001" } } };
const networkError = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => usePaymentSubmission(), { wrapper });
}

beforeEach(() => {
  mockCreatePayment.mockReset();
  mockUploadSlip.mockReset();
});

describe("usePaymentSubmission", () => {
  it("re-sends the SAME idempotency key when a failed submission is retried", async () => {
    mockCreatePayment.mockRejectedValueOnce(networkError).mockResolvedValueOnce(receipt);
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ input, slip: null }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    await act(async () => {
      await result.current.mutateAsync({ input, slip: null });
    });

    expect(mockCreatePayment).toHaveBeenCalledTimes(2);
    const firstKey = mockCreatePayment.mock.calls[0][1];
    expect(firstKey).toMatch(/^[\w-]{8,100}$/);
    expect(mockCreatePayment.mock.calls[1][1]).toBe(firstKey);
    expect(mockCreatePayment.mock.calls[1][0]).toEqual(mockCreatePayment.mock.calls[0][0]);
    await waitFor(() => expect(result.current.data?.receiptNo).toBe("R-2026-000001"));
  });

  it("uploads the slip once and re-sends the same attachment path on retry", async () => {
    mockUploadSlip.mockResolvedValue("staging/u1/1-slip.jpg");
    mockCreatePayment.mockRejectedValueOnce(networkError).mockResolvedValueOnce(receipt);
    const { result } = setup();
    const slip = { uri: "file:///slip.jpg", mime: "image/jpeg" };

    await act(async () => {
      await result.current.mutateAsync({ input, slip }).catch(() => {});
    });
    await act(async () => {
      await result.current.mutateAsync({ input, slip });
    });

    expect(mockUploadSlip).toHaveBeenCalledTimes(1);
    expect(mockCreatePayment.mock.calls[0][0].attachmentPath).toBe("staging/u1/1-slip.jpg");
    expect(mockCreatePayment.mock.calls[1][0]).toEqual(mockCreatePayment.mock.calls[0][0]);
    expect(mockCreatePayment.mock.calls[1][1]).toBe(mockCreatePayment.mock.calls[0][1]);
  });

  it("starts a new key only after reset (a new payment)", async () => {
    mockCreatePayment.mockResolvedValue(receipt);
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ input, slip: null });
    });
    const firstKey = mockCreatePayment.mock.calls[0][1];
    act(() => result.current.reset());
    await act(async () => {
      await result.current.mutateAsync({ input, slip: null });
    });

    expect(mockCreatePayment.mock.calls[1][1]).not.toBe(firstKey);
  });

  it("uploads the slip again when the server says the upload expired, keeping the key", async () => {
    mockUploadSlip.mockResolvedValueOnce("staging/u1/old.jpg").mockResolvedValueOnce("staging/u1/new.jpg");
    const expired = { response: { status: 400, data: { message: "finance.error.attachmentExpired" } } };
    mockCreatePayment.mockRejectedValueOnce(expired).mockResolvedValueOnce(receipt);
    const { result } = setup();
    const slip = { uri: "file:///slip.jpg", mime: "image/jpeg" };

    await act(async () => {
      await result.current.mutateAsync({ input, slip }).catch(() => {});
    });
    await act(async () => {
      await result.current.mutateAsync({ input, slip });
    });

    expect(mockUploadSlip).toHaveBeenCalledTimes(2);
    expect(mockCreatePayment.mock.calls[1][0].attachmentPath).toBe("staging/u1/new.jpg");
    expect(mockCreatePayment.mock.calls[1][1]).toBe(mockCreatePayment.mock.calls[0][1]);
  });
});
