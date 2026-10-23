import type { DatabaseSync } from "node:sqlite";
import { isCategory } from "../domain/categories.js";
import type { Transaction } from "../domain/transaction.js";
import type { TransactionRepository } from "./transactionRepository.js";

type Row = {
  id: string;
  amount: number;
  timestamp: string;
  description: string;
  type: Transaction["type"];
  account_number: string;
  category: string;
};

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

  return {
    async save(t) {
      insert.run(t.id, t.amount, t.timestamp.toISOString(), t.description, t.type, t.accountNumber, t.category);
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
