import { Hono } from "hono";
import type { Categoriser } from "../categoriser/categoriser.js";
import type { TransactionRepository } from "../repository/transactionRepository.js";

export type Deps = {
  categoriser: Categoriser;
  repository: TransactionRepository;
};

// TODO: POST (validate, categorise, persist) and GET /:id.
export const transactionRoutes = ({ repository }: Deps) =>
  new Hono()
    .post("/", (c) => c.json({ error: "not implemented" }, 501))
    .get("/", async (c) => c.json(await repository.list()))
    .get("/:id", (c) => c.json({ error: "not implemented" }, 501));
