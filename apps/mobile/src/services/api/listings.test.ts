import { adminListingsApi } from "./listings";

const mockPost = jest.fn();
jest.mock("./client", () => ({ client: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() } }));

describe("adminListingsApi review version", () => {
  beforeEach(() => mockPost.mockReset());

  it("approve sends the loaded updatedAt as expectedUpdatedAt", async () => {
    await adminListingsApi.approve("l1", "2026-11-02T10:00:00.000Z");
    expect(mockPost).toHaveBeenCalledWith("/admin/listings/l1/approve", { expectedUpdatedAt: "2026-11-02T10:00:00.000Z" });
  });

  it("reject sends the reason and the loaded updatedAt", async () => {
    await adminListingsApi.reject("l1", "Blurry photos", "2026-11-02T10:00:00.000Z");
    expect(mockPost).toHaveBeenCalledWith("/admin/listings/l1/reject", {
      reason: "Blurry photos",
      expectedUpdatedAt: "2026-11-02T10:00:00.000Z",
    });
  });
});
