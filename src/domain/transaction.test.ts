import { describe, expect, it } from "vitest";
import { TransactionInput } from "./transaction.js";

const valid = {
  id: "TXN00001",
  amount: -8718,
  timestamp: "2024-05-16T07:22:18.808Z",
  description: "Municipal Tax Payment",
  type: "debit",
  accountNumber: "NLINGB1944573686",
};

describe("TransactionInput", () => {
  it.each([[0], [-8718], [1], [Number.MAX_SAFE_INTEGER], [-Number.MAX_SAFE_INTEGER]])(
    "accepts an integer amount of cents: %i",
    (amount) => {
      expect(TransactionInput.parse({ ...valid, amount }).amount).toBe(amount);
    },
  );

  it.each([
    ["a decimal (87.18 would be read as 87 cents)", 87.18],
    ["half a cent", 0.5],
    ["one beyond the safe integer range", Number.MAX_SAFE_INTEGER + 1],
    ["a numeric string", "8718"],
    ["null", null],
  ])("rejects an amount that is %s, saying it must be an integer number of cents", (_name, amount) => {
    const result = TransactionInput.safeParse({ ...valid, amount });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.filter((i) => i.path[0] === "amount").map((i) => i.message);
    expect(messages).toEqual(["amount must be an integer number of cents (EUR minor units)"]);
  });

  it("accepts a valid transaction and parses the timestamp to a Date", () => {
    const parsed = TransactionInput.parse(valid);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    expect(parsed.timestamp.toISOString()).toBe("2024-05-16T07:22:18.808Z");
  });

  it.each(["id", "amount", "timestamp", "description", "type", "accountNumber"])(
    "rejects a missing %s",
    (field) => {
      const { [field]: _omitted, ...rest } = valid as Record<string, unknown>;
      expect(TransactionInput.safeParse(rest).success).toBe(false);
    },
  );

  it.each([
    ["empty id", { id: "" }],
    ["empty description", { description: "" }],
    ["empty accountNumber", { accountNumber: "" }],
    ["unknown type", { type: "refund" }],
    ["string amount", { amount: "12.50" }],
    ["NaN amount", { amount: Number.NaN }],
    ["Infinity amount", { amount: Number.POSITIVE_INFINITY }],
    ["unparseable timestamp", { timestamp: "not a date" }],
  ])("rejects %s", (_name, override) => {
    expect(TransactionInput.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each([["missing", undefined], ["unparseable", "not a date"], ["empty", ""]])(
    "a %s timestamp gets a message that names the field and the expected format",
    (_name, timestamp) => {
      const result = TransactionInput.safeParse({ ...valid, timestamp });
      const messages = result.error?.issues.filter((i) => i.path[0] === "timestamp").map((i) => i.message);
      expect(messages).toEqual(["timestamp must be an ISO 8601 date-time"]);
    },
  );

  it.each([
    ["no offset is UTC", "2024-05-16T07:22:18", "2024-05-16T07:22:18.000Z"],
    ["an offset is converted to UTC", "2024-05-16T09:22:18+02:00", "2024-05-16T07:22:18.000Z"],
  ])("timestamp: %s", (_name, timestamp, expected) => {
    expect(TransactionInput.parse({ ...valid, timestamp }).timestamp.toISOString()).toBe(expected);
  });

  it.each([["an impossible date", "2024-02-30T00:00:00Z"], ["date only", "2024-05-16"], ["an epoch number", 1715844138000]])(
    "rejects a timestamp that is: %s",
    (_name, timestamp) => {
      expect(TransactionInput.safeParse({ ...valid, timestamp }).success).toBe(false);
    },
  );

  it("accepts an already-parsed Date (the CSV parser passes one)", () => {
    const date = new Date("2024-05-16T07:22:18.808Z");
    expect(TransactionInput.parse({ ...valid, timestamp: date }).timestamp).toEqual(date);
  });

  it("rejects an invalid Date", () => {
    expect(TransactionInput.safeParse({ ...valid, timestamp: new Date("nope") }).success).toBe(false);
  });

  // data/transaction_history.csv: 494 of 1000 rows have a sign that disagrees with the type
  // (e.g. "Rent Payment", credit, -4028 cents). Rejecting them would drop half the file.
  it.each([
    ["negative credit", { type: "credit", amount: -4028 }],
    ["positive debit", { type: "debit", amount: 17068 }],
  ])("accepts %s: sign and type are not cross-validated", (_name, override) => {
    expect(TransactionInput.safeParse({ ...valid, ...override }).success).toBe(true);
  });
});
