import { Hono } from "hono";
import type { Categoriser } from "../categoriser/categoriser.js";
import type { TransactionRepository } from "../repository/transactionRepository.js";

export type Deps = {
  categoriser: Categoriser;
  repository: TransactionRepository;
};

// TODO: POST (validate, categorise, persist).
export const transactionRoutes = ({ repository }: Deps) =>
  new Hono()
    .post("/", (c) => c.json({ error: "not implemented" }, 501))
    .get("/", async (c) => c.json(await repository.list()))
    .get("/:id", async (c) => {
      const transaction = await repository.get(c.req.param("id"));
      return transaction ? c.json(transaction) : c.json({ error: "Transaction not found" }, 404);
    });
