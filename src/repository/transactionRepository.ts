import type { Transaction } from "../domain/transaction.js";

export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  list(): Promise<Transaction[]>;
  get(id: string): Promise<Transaction | undefined>;
}
