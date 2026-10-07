import { dayKeyFor, hasSchedule, isShopOpenNow, isWithinSchedule } from "./working-hours";

// 2026-10-07 is a Wednesday.
const at = (h: number, m = 0, day = 7) => new Date(2026, 9, day, h, m);
const week = { wed: { open: "09:00", close: "17:00", closed: false }, thu: { open: "09:00", close: "17:00", closed: true } };

describe("working hours", () => {
  it("maps dates to day keys", () => {
    expect(dayKeyFor(at(12))).toBe("wed");
    expect(dayKeyFor(at(12, 0, 4))).toBe("sun");
  });

  it("has no schedule when empty", () => {
    expect(hasSchedule(null)).toBe(false);
    expect(hasSchedule({})).toBe(false);
    expect(isWithinSchedule(null, at(12))).toBeNull();
  });

  it("is open inside and closed outside today's range", () => {
    expect(isWithinSchedule(week, at(9))).toBe(true);
    expect(isWithinSchedule(week, at(16, 59))).toBe(true);
    expect(isWithinSchedule(week, at(17))).toBe(false);
    expect(isWithinSchedule(week, at(8, 59))).toBe(false);
  });

  it("is closed on a closed day and on a day without an entry", () => {
    expect(isWithinSchedule(week, at(12, 0, 8))).toBe(false);
    expect(isWithinSchedule(week, at(12, 0, 9))).toBe(false);
  });

  it("handles overnight ranges", () => {
    const night = { wed: { open: "18:00", close: "02:00", closed: false }, thu: { open: "18:00", close: "02:00", closed: false } };
    expect(isWithinSchedule(night, at(23))).toBe(true);
    expect(isWithinSchedule(night, at(1, 0, 8))).toBe(true);
    expect(isWithinSchedule(night, at(3, 0, 8))).toBe(false);
  });

  it("combines the manual switch with the schedule", () => {
    expect(isShopOpenNow({ isOpen: false, workingHours: week }, at(12))).toBe(false);
    expect(isShopOpenNow({ isOpen: true, workingHours: week }, at(12))).toBe(true);
    expect(isShopOpenNow({ isOpen: true, workingHours: week }, at(20))).toBe(false);
    expect(isShopOpenNow({ isOpen: true, workingHours: null }, at(20))).toBe(true);
  });
});
