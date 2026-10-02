import { PASSWORD_REGEX } from "@/lib/auth/password";
import { mapElection, mapPoll, votePercent } from "@/services/api/governance";
import { buildPlaceOrderPayload, getOrderItemTotal } from "@/services/api/orders";
import { getNotificationHref } from "@/services/notifications/routing";
import { isPersistableQueryKey, shouldRetryQuery } from "@/services/query/client";

jest.mock("env", () => ({
  __esModule: true,
  default: { EXPO_PUBLIC_API_URL: "http://api.test", EXPO_PUBLIC_SOCKET_URL: "http://api.test", EXPO_PUBLIC_VERSION: "1.0.0" },
}), { virtual: true });

jest.mock("@/lib/secure-storage", () => ({
  getSecureItem: jest.fn(async () => null),
  setSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}));

describe("placeOrder payload (OrderCreateDto)", () => {
  it("sends exactly items, paymentMethod, deliveryUnit and notes, never shopId", () => {
    const extra = { price: 5, shopId: "s1" };
    const payload = buildPlaceOrderPayload({
      items: [{ productId: "p1", quantity: 2, ...extra }],
      paymentMethod: "CASH",
      deliveryUnit: " A1-301 ",
      notes: "  ring twice ",
    });
    expect(payload).toEqual({
      items: [{ productId: "p1", quantity: 2 }],
      paymentMethod: "CASH",
      deliveryUnit: "A1-301",
      notes: "ring twice",
    });
    expect(Object.keys(payload)).not.toContain("shopId");
  });

  it("omits empty notes", () => {
    const payload = buildPlaceOrderPayload({ items: [{ productId: "p1", quantity: 1 }], paymentMethod: "PAYMOB", deliveryUnit: "B2", notes: "  " });
    expect(payload).not.toHaveProperty("notes");
  });

  it("computes line totals from unitPrice when lineTotal is absent", () => {
    expect(getOrderItemTotal({ unitPrice: 12.5, quantity: 3 })).toBe(37.5);
    expect(getOrderItemTotal({ unitPrice: 12.5, quantity: 3, lineTotal: 30 })).toBe(30);
    expect(getOrderItemTotal({ quantity: 2 })).toBe(0);
  });
});

describe("governance mapping", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");

  it("maps an open poll without counts", () => {
    const poll = mapPoll({
      id: "p",
      question: "Q",
      questionAr: "Q-ar",
      expiresAt: "2026-10-10T00:00:00Z",
      createdAt: "2026-10-01T00:00:00Z",
      options: [{ id: "o1", label: "Yes", labelAr: "Yes-ar" }, { id: "o2", label: "No", labelAr: "No-ar" }],
      myVoteOptionId: "o1",
    }, now);
    expect(poll.resultsVisible).toBe(false);
    expect(poll.totalVotes).toBeNull();
    expect(poll.myVoteOptionId).toBe("o1");
    expect(poll.isExpired).toBe(false);
  });

  it("totals counts on an expired poll and defaults myVoteOptionId to null", () => {
    const poll = mapPoll({
      id: "p",
      question: "Q",
      questionAr: "Q-ar",
      expiresAt: "2026-10-01T00:00:00Z",
      createdAt: "2026-09-01T00:00:00Z",
      options: [
        { id: "o1", label: "Yes", labelAr: "Yes-ar", voteCount: 3 },
        { id: "o2", label: "No", labelAr: "No-ar", voteCount: 1 },
      ],
    }, now);
    expect(poll.resultsVisible).toBe(true);
    expect(poll.totalVotes).toBe(4);
    expect(poll.myVoteOptionId).toBeNull();
    expect(poll.isExpired).toBe(true);
    expect(votePercent(3, poll.totalVotes)).toBe(75);
    expect(votePercent(undefined, null)).toBe(0);
  });

  it("maps an election with live counts", () => {
    const election = mapElection({
      id: "e",
      title: "T",
      titleAr: "T-ar",
      expiresAt: "2026-10-10T00:00:00Z",
      resultsOpen: false,
      visibilityMode: "LIVE_COUNT",
      createdAt: "2026-10-01T00:00:00Z",
      candidates: [
        { id: "c1", name: "A", nameAr: "A-ar", voteCount: 2 },
        { id: "c2", name: "B", nameAr: "B-ar", voteCount: 0, statement: "s" },
      ],
      myVoteCandidateId: "c1",
    }, now);
    expect(election.resultsVisible).toBe(true);
    expect(election.totalVotes).toBe(2);
    expect(election.myVoteCandidateId).toBe("c1");
    expect(election.candidates[0]).toMatchObject({ statement: null, photoUrl: null, voteCount: 2 });
    expect(election.description).toBeNull();
  });

  it("hides counts for a sealed election", () => {
    const election = mapElection({
      id: "e",
      title: "T",
      titleAr: "T-ar",
      expiresAt: "2026-10-10T00:00:00Z",
      resultsOpen: false,
      visibilityMode: "SEALED_UNTIL_DEADLINE",
      createdAt: "2026-10-01T00:00:00Z",
      candidates: [{ id: "c1", name: "A", nameAr: "A-ar" }],
    }, now);
    expect(election.resultsVisible).toBe(false);
    expect(election.totalVotes).toBeNull();
    expect(election.myVoteCandidateId).toBeNull();
  });
});

describe("notification routing", () => {
  it("maps backend notification types to routes", () => {
    expect(getNotificationHref("ORDER_UPDATE", { orderId: "o1", status: "READY" })).toBe("/(tabs)/orders/o1");
    expect(getNotificationHref("FEEDBACK_UPDATE", { feedbackId: "f1" })).toBe("/(tabs)/community/feedback/f1");
    expect(getNotificationHref("ANNOUNCEMENT", { referenceId: "a1" })).toBe("/(tabs)/community/a1");
    expect(getNotificationHref("POLL", { pollId: "p1" })).toBe("/(tabs)/community/governance/polls/p1");
    expect(getNotificationHref("ELECTION", { electionId: "e1" })).toBe("/(tabs)/community/governance/elections/e1");
  });

  it("infers the type from a push payload without `type`", () => {
    expect(getNotificationHref(undefined, { orderId: "o9", status: "PLACED" })).toBe("/(tabs)/orders/o9");
  });

  it("returns null for unknown or empty payloads", () => {
    expect(getNotificationHref("FEEDBACK_REPLY", {})).toBeNull();
    expect(getNotificationHref("ORDER_UPDATE", null)).toBeNull();
    expect(getNotificationHref(undefined, undefined)).toBeNull();
  });
});

describe("query client policy", () => {
  it("retries only network errors and 5xx, at most twice", () => {
    expect(shouldRetryQuery(0, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(0, { response: { status: 503 } })).toBe(true);
    expect(shouldRetryQuery(0, { response: { status: 400 } })).toBe(false);
    expect(shouldRetryQuery(0, { response: { status: 401 } })).toBe(false);
    expect(shouldRetryQuery(2, { response: { status: 500 } })).toBe(false);
  });

  it("persists only public queries", () => {
    expect(isPersistableQueryKey(["shops", "CAFE_AND_FOOD", ""])).toBe(true);
    expect(isPersistableQueryKey(["announcement", "a1"])).toBe(true);
    expect(isPersistableQueryKey(["orders"])).toBe(false);
    expect(isPersistableQueryKey(["notifications"])).toBe(false);
    expect(isPersistableQueryKey(["my-feedback"])).toBe(false);
    expect(isPersistableQueryKey(["merchant-orders", "PLACED"])).toBe(false);
  });
});

describe("password policy mirrors the backend", () => {
  it.each(["Passw0rd!", "Abcdef1$", "Zz9#zzzz"])("accepts %s", (pw) => {
    expect(PASSWORD_REGEX.test(pw)).toBe(true);
  });
  it.each(["password", "Password1", "PASSWORD1!", "Pass 0rd!", "Pa0!", "كلمةA1!x"])("rejects %s", (pw) => {
    expect(PASSWORD_REGEX.test(pw)).toBe(false);
  });
});
