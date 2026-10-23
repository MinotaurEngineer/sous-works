import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../db/open.js";
import type { Transaction } from "../domain/transaction.js";
import { createSqliteRepository } from "./sqlite.js";
import { DuplicateTransactionError, type TransactionRepository } from "./transactionRepository.js";

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

  it("get returns only the matching row", async () => {
    await repo.save(txn({ id: "A" }));
    await repo.save(txn({ id: "B", category: "Groceries" }));
    expect((await repo.get("B"))?.category).toBe("Groceries");
  });

  it("get fails loudly on a stored row with an invalid category", async () => {
    db.exec("PRAGMA ignore_check_constraints = ON");
    db.prepare("INSERT INTO transactions VALUES (?,?,?,?,?,?,?)").run(
      "BAD", 1, "2024-01-01T00:00:00.000Z", "d", "debit", "a", "Food",
    );
    await expect(repo.get("BAD")).rejects.toThrow(/BAD.*Food/);
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

  it("lists transactions with every field mapped back to the domain shape", async () => {
    await repo.save(txn());
    expect(await repo.list()).toEqual([txn()]);
  });

  it("lists in timestamp order, then id, regardless of insertion order", async () => {
    await repo.save(txn({ id: "C", timestamp: new Date("2024-02-01T00:00:00.000Z") }));
    await repo.save(txn({ id: "B", timestamp: new Date("2024-01-01T00:00:00.000Z") }));
    await repo.save(txn({ id: "A", timestamp: new Date("2024-01-01T00:00:00.000Z") }));
    expect((await repo.list()).map((t) => t.id)).toEqual(["A", "B", "C"]);
  });

  it("list fails loudly on a stored row with an invalid category", async () => {
    db.exec("PRAGMA ignore_check_constraints = ON");
    db.prepare("INSERT INTO transactions VALUES (?,?,?,?,?,?,?)").run(
      "BAD", 1, "2024-01-01T00:00:00.000Z", "d", "debit", "a", "Food",
    );
    await expect(repo.list()).rejects.toThrow(/BAD.*Food/);
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

describe("SqliteRepository: duplicates and saveAll", () => {
  it("save throws DuplicateTransactionError for an existing id", async () => {
    await repo.save(txn());
    await expect(repo.save(txn())).rejects.toBeInstanceOf(DuplicateTransactionError);
  });

  it("saveAll stores every transaction", async () => {
    await repo.saveAll([txn({ id: "A" }), txn({ id: "B" }), txn({ id: "C" })]);
    expect((await repo.list()).map((t) => t.id)).toEqual(["A", "B", "C"]);
  });

  it("saveAll with no transactions is a no-op", async () => {
    await repo.saveAll([]);
    expect(await repo.list()).toEqual([]);
  });

  it("saveAll is atomic: an id already stored rejects the whole batch", async () => {
    await repo.save(txn({ id: "B" }));
    await expect(repo.saveAll([txn({ id: "A" }), txn({ id: "B" }), txn({ id: "C" })])).rejects.toBeInstanceOf(
      DuplicateTransactionError,
    );
    expect((await repo.list()).map((t) => t.id)).toEqual(["B"]);
  });

  it("saveAll is atomic: an id repeated inside the batch rejects the whole batch", async () => {
    await expect(repo.saveAll([txn({ id: "A" }), txn({ id: "A" })])).rejects.toBeInstanceOf(
      DuplicateTransactionError,
    );
    expect(await repo.list()).toEqual([]);
  });

  it("saveAll rolls back on a non-duplicate failure and rethrows it unchanged", async () => {
    const bad = txn({ id: "B", category: "Food" as never });
    const failure = await repo.saveAll([txn({ id: "A" }), bad]).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(DuplicateTransactionError);
    expect(await repo.list()).toEqual([]);
  });

  it("stays usable after a failed saveAll (the transaction was closed)", async () => {
    await repo.saveAll([txn({ id: "A" }), txn({ id: "A" })]).catch(() => {});
    await repo.saveAll([txn({ id: "A" })]);
    expect(await repo.list()).toHaveLength(1);
  });
});

