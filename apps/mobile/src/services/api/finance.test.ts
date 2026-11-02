import { financeApi, IDEMPOTENCY_HEADER } from "./finance";

const mockPost = jest.fn();
jest.mock("./client", () => ({ client: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() } }));

describe("financeApi", () => {
  beforeEach(() => mockPost.mockReset());

  it("createPayment sends the Idempotency-Key header and a decimal-string amount", async () => {
    const body = { flatId: "flat_A1-3-2", amount: "450.00", method: "CASH" as const, receivedAt: "2026-11-02" };
    await financeApi.createPayment(body, "pay-key-123456");
    expect(IDEMPOTENCY_HEADER).toBe("Idempotency-Key");
    expect(mockPost).toHaveBeenCalledWith("/finance/payments", body, { headers: { "Idempotency-Key": "pay-key-123456" } });
    expect(typeof mockPost.mock.calls[0][1].amount).toBe("string");
  });

  it("applyCredit sends the displayed credit as expectedCredit", async () => {
    await financeApi.applyCredit("flat_A1-3-2", "550.00");
    expect(mockPost).toHaveBeenCalledWith("/finance/flats/flat_A1-3-2/apply-credit", { expectedCredit: "550.00" });
  });

  it("uploadSlip posts multipart to the private attachments route and returns the path", async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { path: "staging/u1/1-x.jpg" } } });
    await expect(financeApi.uploadSlip("file:///tmp/slip.jpg", "image/jpeg")).resolves.toBe("staging/u1/1-x.jpg");
    expect(mockPost.mock.calls[0][0]).toBe("/finance/attachments");
  });
});
