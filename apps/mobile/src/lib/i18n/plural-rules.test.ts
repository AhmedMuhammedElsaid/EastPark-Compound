import { SimplePluralRules } from "./plural-rules";

describe("simplePluralRules", () => {
  it("matches the CLDR Arabic categories for the counts the app shows", () => {
    const ar = new SimplePluralRules("ar");
    expect([0, 1, 2, 3, 10, 11, 99, 100, 101, 102, 103, 111].map(n => ar.select(n)))
      .toEqual(["zero", "one", "two", "few", "few", "many", "many", "other", "other", "other", "few", "many"]);
  });

  it("agrees with the engine's Intl.PluralRules where it exists", () => {
    const real = new Intl.PluralRules("ar");
    const mine = new SimplePluralRules("ar");
    for (let n = 0; n <= 300; n++)
      expect(mine.select(n)).toBe(real.select(n));
  });

  it("handles English and exposes the categories i18next reads", () => {
    const en = new SimplePluralRules("en-US");
    expect([0, 1, 2].map(n => en.select(n))).toEqual(["other", "one", "other"]);
    expect(en.resolvedOptions().pluralCategories).toEqual(["one", "other"]);
    expect(new SimplePluralRules("ar").resolvedOptions().pluralCategories).toHaveLength(6);
  });
});
