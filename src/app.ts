import { Hono } from "hono";
import { transactionRoutes, type Deps } from "./routes/transactions.js";

export const createApp = (deps: Deps) =>
  new Hono()
    .get("/health", (c) => c.json({ status: "ok" }))
    .route("/transactions", transactionRoutes(deps));
