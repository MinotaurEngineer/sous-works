import { describe, expect, it, vi } from "vitest";
import type { TransactionInput } from "../domain/transaction.js";
import type { Categoriser } from "./categoriser.js";
import { CategorisationError, categoriseTransactions } from "./categorise.js";

const input = (id: string): TransactionInput => ({
  id,
  amount: -1,
  timestamp: new Date("2024-01-01T00:00:00.000Z"),
  description: "Rent Payment",
  type: "debit",
  accountNumber: "NL1",
});

const categoriserReturning = (...categories: Awaited<ReturnType<Categoriser["categorise"]>>): Categoriser => ({
  categorise: vi.fn(async () => categories),
});

describe("categoriseTransactions", () => {
  it("attaches each category to its own transaction, in order", async () => {
    const result = await categoriseTransactions(categoriserReturning("Housing", "Groceries"), [input("A"), input("B")]);
    expect(result.map((t) => [t.id, t.category])).toEqual([
      ["A", "Housing"],
      ["B", "Groceries"],
    ]);
  });

  it("keeps every input field unchanged", async () => {
    const [result] = await categoriseTransactions(categoriserReturning("Housing"), [input("A")]);
    expect(result).toEqual({ ...input("A"), category: "Housing" });
  });

  it("wraps a categoriser failure in CategorisationError, keeping the cause", async () => {
    const cause = new Error("upstream down");
    const failing: Categoriser = { categorise: async () => Promise.reject(cause) };
    const error = await categoriseTransactions(failing, [input("A")]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CategorisationError);
    expect((error as CategorisationError).cause).toBe(cause);
  });

  it.each([[[]], [["Housing", "Groceries"]]])("throws CategorisationError on a wrong count: %j", async (categories) => {
    await expect(
      categoriseTransactions(categoriserReturning(...(categories as never[])), [input("A")]),
    ).rejects.toThrow(CategorisationError);
  });
});
