import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../db/open.js";
import type { Transaction } from "../domain/transaction.js";
import { createSqliteRepository } from "./sqlite.js";
import type { TransactionRepository } from "./transactionRepository.js";

const txn = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "TXN00001",
  amount: -87.18,
  timestamp: new Date("2024-05-16T07:22:18.808Z"),
  description: "Municipal Tax Payment",
  type: "debit",
  accountNumber: "NLINGB1944573686",
  category: "Housing",
  ...overrides,
});

let repo: TransactionRepository;
let db: ReturnType<typeof openDatabase>;

beforeEach(() => {
  db = openDatabase(":memory:");
  repo = createSqliteRepository(db);
});

describe("SqliteRepository", () => {
  it("round-trips a transaction unchanged, including the Date and category", async () => {
    await repo.save(txn());
    expect(await repo.get("TXN00001")).toEqual(txn());
  });

  it("returns undefined for an unknown id", async () => {
    expect(await repo.get("nope")).toBeUndefined();
  });

  it("lists nothing when empty", async () => {
    expect(await repo.list()).toEqual([]);
  });

  it("lists every saved transaction", async () => {
    await repo.save(txn({ id: "A" }));
    await repo.save(txn({ id: "B", category: "Groceries" }));
    const ids = (await repo.list()).map((t) => t.id).sort();
    expect(ids).toEqual(["A", "B"]);
  });

  it("rejects a duplicate id rather than overwriting", async () => {
    await repo.save(txn());
    await expect(repo.save(txn({ category: "Groceries" }))).rejects.toThrow();
    expect((await repo.get("TXN00001"))?.category).toBe("Housing");
  });

  it("treats ids as data: SQL metacharacters are stored, not executed", async () => {
    const hostile = "x'); DROP TABLE transactions;--";
    await repo.save(txn({ id: hostile }));
    expect((await repo.get(hostile))?.id).toBe(hostile);
    expect(await repo.list()).toHaveLength(1);
  });

  it("the schema itself rejects a category outside the 10", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO transactions (id, amount, timestamp, description, type, account_number, category) VALUES (?,?,?,?,?,?,?)",
        )
        .run("X", 1, "2024-01-01T00:00:00.000Z", "d", "debit", "acc", "Food"),
    ).toThrow();
  });
});
