import { getActiveConfirm, registerConfirmHost, settleConfirm, showConfirm, subscribeConfirm } from "./confirm-dialog";

const base = { title: "Sign out?", confirmLabel: "Sign out" };

describe("confirm dialog store", () => {
  let unregister: (() => void) | null = null;

  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  it("resolves false at once when no host is mounted", async () => {
    await expect(showConfirm(base)).resolves.toBe(false);
    expect(getActiveConfirm()).toBeNull();
  });

  it("shows the request and resolves with the chosen answer", async () => {
    unregister = registerConfirmHost();
    const answer = showConfirm({ ...base, destructive: true });
    const active = getActiveConfirm();
    expect(active).toMatchObject({ title: "Sign out?", destructive: true });
    settleConfirm(active!.id, true);
    await expect(answer).resolves.toBe(true);
    expect(getActiveConfirm()).toBeNull();
  });

  it("hides the request before its promise resolves", async () => {
    unregister = registerConfirmHost();
    const answer = showConfirm(base).then(() => getActiveConfirm());
    settleConfirm(getActiveConfirm()!.id, false);
    await expect(answer).resolves.toBeNull();
  });

  it("queues requests and shows them one at a time", async () => {
    unregister = registerConfirmHost();
    const first = showConfirm({ ...base, title: "First" });
    const second = showConfirm({ ...base, title: "Second" });
    expect(getActiveConfirm()?.title).toBe("First");
    settleConfirm(getActiveConfirm()!.id, false);
    expect(getActiveConfirm()?.title).toBe("Second");
    settleConfirm(getActiveConfirm()!.id, true);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
  });

  it("ignores unknown or already settled ids", async () => {
    unregister = registerConfirmHost();
    const answer = showConfirm(base);
    const { id } = getActiveConfirm()!;
    settleConfirm(id + 1000, true);
    expect(getActiveConfirm()?.id).toBe(id);
    settleConfirm(id, false);
    settleConfirm(id, true);
    await expect(answer).resolves.toBe(false);
  });

  it("notifies subscribers on every change", () => {
    unregister = registerConfirmHost();
    const listener = jest.fn();
    const unsubscribe = subscribeConfirm(listener);
    void showConfirm(base);
    settleConfirm(getActiveConfirm()!.id, false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("resolves open requests false when the last host unmounts", async () => {
    const stop = registerConfirmHost();
    const answer = showConfirm(base);
    stop();
    await expect(answer).resolves.toBe(false);
    expect(getActiveConfirm()).toBeNull();
  });
});
