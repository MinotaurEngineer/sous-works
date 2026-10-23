import { z } from "zod";
import type { Category } from "./categories.js";
import { parseTimestamp } from "./timestamp.js";

const AMOUNT_ERROR = "amount must be an integer number of cents (EUR minor units)";

/** Input contract for POST /transactions and for each CSV row. */
export const TransactionInput = z.object({
  id: z.string().min(1),
  amount: z
    .number({ error: AMOUNT_ERROR })
    .int({ error: AMOUNT_ERROR }),
  timestamp: z.preprocess(
    (value) => (typeof value === "string" ? parseTimestamp(value) : value),
    z.date({ error: "timestamp must be an ISO 8601 date-time" }),
  ),
  description: z.string().min(1),
  type: z.enum(["debit", "credit"]),
  accountNumber: z.string().min(1),
});
export type TransactionInput = z.infer<typeof TransactionInput>;

export type Transaction = TransactionInput & { category: Category };
