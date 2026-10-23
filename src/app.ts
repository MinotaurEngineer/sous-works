import { Hono } from "hono";
import { importRoutes } from "./routes/import.js";
import { transactionRoutes, type Deps } from "./routes/transactions.js";

export const createApp = (deps: Deps) =>
  new Hono()
    .get("/health", (c) => c.json({ status: "ok" }))
    .route("/transactions/import", importRoutes(deps))
    .route("/transactions", transactionRoutes(deps));
