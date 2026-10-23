import type { Category } from "../domain/categories.js";
import type { TransactionInput } from "../domain/transaction.js";

/** Contract: returns exactly one Category per input, in input order. */
export interface Categoriser {
  categorise(transactions: TransactionInput[]): Promise<Category[]>;
}
