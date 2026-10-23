import type { Transaction, TransactionInput } from "../domain/transaction.js";
import type { Categoriser } from "./categoriser.js";

/** The categoriser failed or broke its contract (one Category per input). */
export class CategorisationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CategorisationError";
  }
}

/** Categorises `inputs` in one call and attaches each Category to its own transaction. */
export const categoriseTransactions = async (
  categoriser: Categoriser,
  inputs: TransactionInput[],
): Promise<Transaction[]> => {
  let categories;
  try {
    categories = await categoriser.categorise(inputs);
  } catch (cause) {
    throw new CategorisationError("Categoriser failed", { cause });
  }
  if (categories.length !== inputs.length) {
    throw new CategorisationError(`Expected ${inputs.length} categories, got ${categories.length}`);
  }
  return inputs.map((input, i) => ({ ...input, category: categories[i]! }));
};
