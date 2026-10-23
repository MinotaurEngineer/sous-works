import { Hono } from "hono";
import type { Categoriser } from "../categoriser/categoriser.js";
import type { TransactionRepository } from "../repository/transactionRepository.js";

export type Deps = {
  categoriser: Categoriser;
  repository: TransactionRepository;
};

// TODO: validate with TransactionInput, categorise, persist.
export const transactionRoutes = (_deps: Deps) =>
  new Hono()
    .post("/", (c) => c.json({ error: "not implemented" }, 501))
    .get("/", (c) => c.json({ error: "not implemented" }, 501))
    .get("/:id", (c) => c.json({ error: "not implemented" }, 501));
