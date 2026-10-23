import { describe, expect, it } from "vitest";
import { TransactionInput } from "./transaction.js";

const valid = {
  id: "TXN00001",
  amount: -87.18,
  timestamp: "2024-05-16T07:22:18.808Z",
  description: "Municipal Tax Payment",
  type: "debit",
  accountNumber: "NLINGB1944573686",
};

describe("TransactionInput", () => {
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

  // data/transaction_history.csv: 494 of 1000 rows have a sign that disagrees with the type
  // (e.g. "Rent Payment", credit, -40.28). Rejecting them would drop half the file.
  it.each([
    ["negative credit", { type: "credit", amount: -40.28 }],
    ["positive debit", { type: "debit", amount: 170.68 }],
  ])("accepts %s: sign and type are not cross-validated", (_name, override) => {
    expect(TransactionInput.safeParse({ ...valid, ...override }).success).toBe(true);
  });
});
