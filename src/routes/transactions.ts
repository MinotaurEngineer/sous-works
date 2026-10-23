import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { CategorisationError, categoriseTransactions } from "../categoriser/categorise.js";
import type { Categoriser } from "../categoriser/categoriser.js";
import { TransactionInput } from "../domain/transaction.js";
import {
  DuplicateTransactionError,
  type TransactionRepository,
} from "../repository/transactionRepository.js";

export const MAX_TRANSACTION_BYTES = 16 * 1024;

export type Deps = {
  categoriser: Categoriser;
  repository: TransactionRepository;
};

export const transactionRoutes = ({ categoriser, repository }: Deps) =>
  new Hono()
    .post(
      "/",
      bodyLimit({ maxSize: MAX_TRANSACTION_BYTES, onError: (c) => c.json({ error: "Body too large" }, 413) }),
      async (c) => {
        const body = await c.req.json().catch(() => undefined);
        if (body === undefined) return c.json({ error: "Body must be valid JSON" }, 400);

        const parsed = TransactionInput.safeParse(body);
        if (!parsed.success) {
          const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
          return c.json({ error: "Invalid transaction", issues }, 400);
        }

        try {
          const [transaction] = await categoriseTransactions(categoriser, [parsed.data]);
          await repository.save(transaction!);
          return c.json(transaction, 201);
        } catch (e) {
          if (e instanceof CategorisationError) {
            console.error(e);
            return c.json({ error: "Categorisation failed" }, 502);
          }
          if (e instanceof DuplicateTransactionError) {
            return c.json({ error: "Transaction id already exists" }, 409);
          }
          throw e;
        }
      },
    )
    .get("/", async (c) => c.json(await repository.list()))
    .get("/:id", async (c) => {
      const transaction = await repository.get(c.req.param("id"));
      return transaction ? c.json(transaction) : c.json({ error: "Transaction not found" }, 404);
    });
