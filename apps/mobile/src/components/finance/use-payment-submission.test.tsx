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
  financeKeys: { all: ["finance"] },
}));

const input = { flatId: "flat_A1-3-2", amount: "450.00", method: "CASH" as const, receivedAt: "2026-11-02" };
const receipt = { data: { data: { id: "p1", receiptNo: "R-2026-000001" } } };
const networkError = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
const gatewayError = { response: { status: 504, data: {} } };

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => usePaymentSubmission(), { wrapper }) };
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

describe("usePaymentSubmission: cache and unconfirmed attempts", () => {
  it("invalidates the finance root after a payment is recorded", async () => {
    mockCreatePayment.mockResolvedValue(receipt);
    const { result, client } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({ input, slip: null });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["finance"] });
  });

  it("does not invalidate anything when the payment fails", async () => {
    mockCreatePayment.mockRejectedValue({ response: { status: 400, data: {} } });
    const { result, client } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({ input, slip: null }).catch(() => {});
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("re-sends the FIRST body and key verbatim while unconfirmed, even after the date and fields change", async () => {
    mockUploadSlip.mockResolvedValue("staging/u1/1-slip.jpg");
    mockCreatePayment.mockRejectedValueOnce(networkError).mockRejectedValueOnce(gatewayError).mockResolvedValueOnce(receipt);
    const { result } = setup();
    const slip = { uri: "file:///slip.jpg", mime: "image/jpeg" };

    await act(async () => {
      await result.current.mutateAsync({ input: { ...input, force: true }, slip }).catch(() => {});
    });
    expect(result.current.unconfirmed).toBe(true);
    expect(result.current.pending()?.body.flatId).toBe(input.flatId);

    // Past Cairo midnight, a different amount and another slip: none of it may reach the server.
    const changed = { ...input, amount: "500.00", receivedAt: "2026-11-03" };
    await act(async () => {
      await result.current.mutateAsync({ input: changed, slip: { uri: "file:///other.jpg", mime: "image/jpeg" } }).catch(() => {});
    });
    expect(result.current.unconfirmed).toBe(true);
    await act(async () => {
      await result.current.mutateAsync({ input: changed, slip: null });
    });

    expect(mockUploadSlip).toHaveBeenCalledTimes(1);
    expect(mockCreatePayment).toHaveBeenCalledTimes(3);
    const [firstBody, firstKey] = mockCreatePayment.mock.calls[0];
    expect(firstBody).toEqual({ ...input, force: true, attachmentPath: "staging/u1/1-slip.jpg" });
    for (const [body, key] of mockCreatePayment.mock.calls.slice(1)) {
      expect(body).toEqual(firstBody);
      expect(key).toBe(firstKey);
    }
    expect(result.current.unconfirmed).toBe(false);
  });

  it("retry() re-sends the unconfirmed request", async () => {
    mockCreatePayment.mockRejectedValueOnce({ response: { status: 503, data: {} } }).mockResolvedValueOnce(receipt);
    const { result } = setup();

    await act(async () => {
      result.current.submit({ input, slip: null });
    });
    await waitFor(() => expect(result.current.unconfirmed).toBe(true));
    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.data?.receiptNo).toBe("R-2026-000001"));
    expect(mockCreatePayment.mock.calls[1]).toEqual(mockCreatePayment.mock.calls[0]);
  });

  it("a definite rejection unlocks the form: the next attempt sends the edited body", async () => {
    mockCreatePayment.mockRejectedValueOnce({ response: { status: 400, data: { message: "finance.error.futureDate" } } }).mockResolvedValueOnce(receipt);
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ input, slip: null }).catch(() => {});
    });
    expect(result.current.unconfirmed).toBe(false);
    await act(async () => {
      await result.current.mutateAsync({ input: { ...input, receivedAt: "2026-11-01" }, slip: null });
    });

    expect(mockCreatePayment.mock.calls[1][0].receivedAt).toBe("2026-11-01");
  });

  it("discard() drops the unconfirmed attempt: the edited payment gets a NEW key", async () => {
    mockCreatePayment.mockRejectedValueOnce(networkError).mockResolvedValueOnce(receipt);
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ input, slip: null }).catch(() => {});
    });
    act(() => result.current.discard());
    expect(result.current.unconfirmed).toBe(false);
    await act(async () => {
      await result.current.mutateAsync({ input: { ...input, amount: "400.00" }, slip: null });
    });

    expect(mockCreatePayment.mock.calls[1][0].amount).toBe("400.00");
    expect(mockCreatePayment.mock.calls[1][1]).not.toBe(mockCreatePayment.mock.calls[0][1]);
  });
});
