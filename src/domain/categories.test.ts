import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, FALLBACK_CATEGORY, isCategory } from "./categories.js";

// The brief's category list is shipped as data/categories.txt ("1. Groceries" ...).
const briefCategories = readFileSync(new URL("../../data/categories.txt", import.meta.url), "utf8")
  .split("\n")
  .map((line) => line.replace(/^\d+\.\s*/, "").trim())
  .filter(Boolean);

describe("CATEGORIES", () => {
  it("are exactly the 10 categories in the brief, in order", () => {
    expect(briefCategories).toHaveLength(10);
    expect([...CATEGORIES]).toEqual(briefCategories);
  });
});

describe("FALLBACK_CATEGORY", () => {
  it("is Miscellaneous and is itself a valid category", () => {
    expect(FALLBACK_CATEGORY).toBe("Miscellaneous");
    expect(isCategory(FALLBACK_CATEGORY)).toBe(true);
  });
});

describe("isCategory", () => {
  it.each(CATEGORIES)("accepts %s", (category) => {
    expect(isCategory(category)).toBe(true);
  });

  it.each([["groceries"], ["Dining out"], [" Groceries"], [""], ["Food"]])(
    "rejects %j (exact match only)",
    (value) => {
      expect(isCategory(value)).toBe(false);
    },
  );

  it.each([[undefined], [null], [1], [{}], [["Groceries"]]])("rejects non-string %j", (value) => {
    expect(isCategory(value)).toBe(false);
  });
});
