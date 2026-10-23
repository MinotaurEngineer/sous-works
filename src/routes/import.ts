import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { CategorisationError, categoriseTransactions } from "../categoriser/categorise.js";
import { CsvParseError, parseTransactionsCsv } from "../csv/parse.js";
import { DuplicateTransactionError } from "../repository/transactionRepository.js";
import type { Deps } from "./transactions.js";

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ISSUES_REPORTED = 20;

const isCsv = (contentType: string | undefined) =>
  contentType?.split(";")[0]?.trim().toLowerCase() === "text/csv";

export const importRoutes = ({ categoriser, repository }: Deps) =>
  new Hono().post(
    "/",
    async (c, next) =>
      isCsv(c.req.header("content-type")) ? next() : c.json({ error: "Content-Type must be text/csv" }, 415),
    bodyLimit({ maxSize: MAX_CSV_BYTES, onError: (c) => c.json({ error: "CSV too large" }, 413) }),
    async (c) => {
      let inputs;
      try {
        inputs = parseTransactionsCsv(await c.req.text());
      } catch (e) {
        if (!(e instanceof CsvParseError)) throw e;
        return c.json({ error: "Invalid CSV", total: e.issues.length, issues: e.issues.slice(0, MAX_ISSUES_REPORTED) }, 400);
      }
      if (inputs.length === 0) return c.json({ error: "CSV contains no transactions" }, 400);

      try {
        await repository.saveAll(await categoriseTransactions(categoriser, inputs));
      } catch (e) {
        if (e instanceof CategorisationError) {
          console.error(e);
          return c.json({ error: "Categorisation failed" }, 502);
        }
        if (e instanceof DuplicateTransactionError) {
          return c.json({ error: "One or more transaction ids already exist" }, 409);
        }
        throw e;
      }
      return c.json({ imported: inputs.length }, 201);
    },
  );
