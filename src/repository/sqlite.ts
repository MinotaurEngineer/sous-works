import type { DatabaseSync } from "node:sqlite";
import type { TransactionRepository } from "./transactionRepository.js";

// TODO: implement against db/schema.sql using prepared statements with bound parameters only.
export const createSqliteRepository = (_db: DatabaseSync): TransactionRepository => ({
  async save() {
    throw new Error("SqliteRepository.save not implemented");
  },
  async list() {
    throw new Error("SqliteRepository.list not implemented");
  },
  async get() {
    throw new Error("SqliteRepository.get not implemented");
  },
});
