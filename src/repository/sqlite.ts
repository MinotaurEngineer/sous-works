import type { DatabaseSync } from "node:sqlite";
import { isCategory } from "../domain/categories.js";
import type { Transaction } from "../domain/transaction.js";
import { DuplicateTransactionError, type TransactionRepository } from "./transactionRepository.js";

type Row = {
  id: string;
  amount: number;
  timestamp: string;
  description: string;
  type: Transaction["type"];
  account_number: string;
  category: string;
};

// node:sqlite reports a primary-key violation as errcode 1555 (SQLITE_CONSTRAINT_PRIMARYKEY).
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;

const toTransaction = (row: Row): Transaction => {
  if (!isCategory(row.category)) {
    throw new Error(`Stored transaction ${row.id} has invalid category "${row.category}"`);
  }
  return {
    id: row.id,
    amount: row.amount,
    timestamp: new Date(row.timestamp),
    description: row.description,
    type: row.type,
    accountNumber: row.account_number,
    category: row.category,
  };
};

export const createSqliteRepository = (db: DatabaseSync): TransactionRepository => {
  const insert = db.prepare(
    `INSERT INTO transactions (id, amount, timestamp, description, type, account_number, category)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectOne = db.prepare("SELECT * FROM transactions WHERE id = ?");
  const selectAll = db.prepare("SELECT * FROM transactions ORDER BY timestamp, id");

  const insertOne = (t: Transaction) => {
    try {
      insert.run(t.id, t.amount, t.timestamp.toISOString(), t.description, t.type, t.accountNumber, t.category);
    } catch (e) {
      if ((e as { errcode?: number }).errcode === SQLITE_CONSTRAINT_PRIMARYKEY) {
        throw new DuplicateTransactionError();
      }
      throw e;
    }
  };

  return {
    async save(t) {
      insertOne(t);
    },
    async saveAll(ts) {
      db.exec("BEGIN");
      try {
        ts.forEach(insertOne);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async list() {
      return (selectAll.all() as Row[]).map(toTransaction);
    },
    async get(id) {
      const row = selectOne.get(id) as Row | undefined;
      return row && toTransaction(row);
    },
  };
};
