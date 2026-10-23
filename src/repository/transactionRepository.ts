import type { Transaction } from "../domain/transaction.js";

/** Thrown by save and saveAll when a transaction id is already stored. */
export class DuplicateTransactionError extends Error {
  constructor() {
    super("Transaction id already exists");
    this.name = "DuplicateTransactionError";
  }
}

export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  /** Atomic: stores every transaction or none. */
  saveAll(transactions: Transaction[]): Promise<void>;
  list(): Promise<Transaction[]>;
  get(id: string): Promise<Transaction | undefined>;
}
