import { describe, expect, it } from "vitest";
import { normaliseCategories } from "./normalise.js";

describe("normaliseCategories", () => {
  it("passes valid categories through in order", () => {
    expect(normaliseCategories(["Groceries", "Dining Out", "Housing"], 3)).toEqual([
      "Groceries",
      "Dining Out",
      "Housing",
    ]);
  });

  it.each([["Food"], ["groceries"], [""], [null], [42], [undefined]])(
    "maps invalid label %j to Miscellaneous instead of failing",
    (label) => {
      expect(normaliseCategories(["Groceries", label], 2)).toEqual(["Groceries", "Miscellaneous"]);
    },
  );

  it("throws when the model returned fewer labels than transactions", () => {
    expect(() => normaliseCategories(["Groceries"], 2)).toThrow(/expected 2.*got 1/i);
  });

  it("throws when the model returned more labels than transactions", () => {
    expect(() => normaliseCategories(["Groceries", "Housing"], 1)).toThrow(/expected 1.*got 2/i);
  });

  it("handles an empty batch", () => {
    expect(normaliseCategories([], 0)).toEqual([]);
  });
});
