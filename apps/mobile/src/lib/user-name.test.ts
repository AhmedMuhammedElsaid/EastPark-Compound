import ar from "@/translations/ar.json";
import en from "@/translations/en.json";

import { displayUserName, isDeletedUserName } from "./user-name";

describe("user name", () => {
  it("recognises the backend tombstone name", () => {
    expect(isDeletedUserName("Deleted user")).toBe(true);
    expect(isDeletedUserName("  Deleted user ")).toBe(true);
    expect(isDeletedUserName("Deleted User Smith")).toBe(false);
    expect(isDeletedUserName(undefined)).toBe(false);
  });

  it("swaps the tombstone for the label and keeps real names", () => {
    expect(displayUserName("Deleted user", "مستخدم محذوف")).toBe("مستخدم محذوف");
    expect(displayUserName("Mona", "x")).toBe("Mona");
    expect(displayUserName(undefined, "x")).toBe("");
  });

  it("has the label in both languages", () => {
    expect(en.common.deleted_user).toBeTruthy();
    expect(ar.common.deleted_user).toBeTruthy();
  });
});
