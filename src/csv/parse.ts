import type { TransactionInput } from "../domain/transaction.js";

// TODO: parse with csv-parse; map headers
// "Transaction ID,Amount,Timestamp,Description,Transaction Type,Account Number"
// to TransactionInput; report invalid rows with row number, never skip silently.
export const parseTransactionsCsv = (_csv: string): TransactionInput[] => {
  throw new Error("parseTransactionsCsv not implemented");
};
