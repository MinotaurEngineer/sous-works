import { describe, expect, it } from "vitest";
import { parseDecimalToCents } from "./money.js";

describe("parseDecimalToCents: accepted", () => {
  it.each([
    ["two decimals", "87.18", 8718],
    ["negative", "-87.18", -8718],
    ["one decimal (94 of the 1000 sample amounts)", "170.7", 17070],
    ["whole number", "100", 10000],
    ["zero", "0", 0],
    ["less than one unit", "0.07", 7],
    ["trailing zero", "0.10", 10],
    ["half a unit", "1.5", 150],
    ["negative zero is plain zero", "-0", 0],
    ["negative zero with decimals", "-0.00", 0],
  ])("%s", (_name, raw, cents) => {
    expect(parseDecimalToCents(raw)).toBe(cents);
  });

  // Float multiplication gets these wrong: 1.15 * 100 === 114.99999999999999.
  // 47 of the 1000 amounts in data/transaction_history.csv are hit by this trap.
  it.each([
    ["1.15", 115],
    ["0.29", 29],
    ["-309.34", -30934],
    ["-150.23", -15023],
    ["258.65", 25865],
    ["-267.09", -26709],
  ])("is exact where float multiplication is not: %s", (raw, cents) => {
    expect(parseDecimalToCents(raw)).toBe(cents);
  });

  it("never returns negative zero", () => {
    expect(Object.is(parseDecimalToCents("-0"), 0)).toBe(true);
  });

  it("accepts the largest amount that is a safe integer of cents, both signs", () => {
    expect(parseDecimalToCents("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseDecimalToCents("-90071992547409.91")).toBe(-Number.MAX_SAFE_INTEGER);
  });

  it("round-trips every cent value from -20000 to 20000", () => {
    for (let cents = -20000; cents <= 20000; cents++) {
      const abs = Math.abs(cents);
      const text = `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
      expect(parseDecimalToCents(text)).toBe(cents);
    }
  });
});

describe("parseDecimalToCents: rejected (never rounded, never guessed)", () => {
  it.each([
    ["empty", ""],
    ["blank", " "],
    ["words", "abc"],
    ["exponent", "1e3"],
    ["comma decimal", "1,5"],
    ["thousands separator", "1,000.00"],
    ["underscore", "1_000"],
    ["hex", "0x10"],
    ["no leading digit", ".5"],
    ["no trailing digit", "5."],
    ["three decimals (would need rounding)", "1.234"],
    ["leading space", " 1"],
    ["trailing space", "1 "],
    ["double minus", "--1"],
    ["plus sign", "+1"],
    ["two dots", "1.2.3"],
    ["Infinity", "Infinity"],
    ["NaN", "NaN"],
    ["one cent above the safe maximum", "90071992547409.92"],
    ["negative above the safe maximum", "-90071992547409.92"],
    ["far beyond a safe integer", "99999999999999999999"],
  ])("%s", (_name, raw) => {
    expect(parseDecimalToCents(raw)).toBeUndefined();
  });
});
