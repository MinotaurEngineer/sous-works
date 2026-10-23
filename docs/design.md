# Design and trade-offs

## Stack and reasoning

These are the author's choices.

- **TypeScript**: types end to end, and zod validates input at the boundary (`TransactionInput`, environment variables).
- **Hono**: small, fast, built on web standards. `app.request()` lets route tests run without a server.
- **SQLite via `node:sqlite`**: one file, no native dependency and no database container, so the Docker setup stays a single service plus a volume.
- **Anthropic API** (`@anthropic-ai/sdk`) for categorisation; default model `claude-haiku-5-5`, configurable.

Structure: routes depend on two contracts, `Categoriser` (one Category per input, in input order) and `TransactionRepository` (`save`, `saveAll` atomic, `list`, `get`). The model and the database are replaceable behind them.

## Categorisation algorithm

Both `POST /transactions` and `POST /transactions/import` call `categoriseTransactions`: one `Categoriser` call, count contract enforced, throws `CategorisationError` (routes return 502). The Anthropic `Categoriser` works as follows.

1. Collect the **distinct descriptions** of the inputs and drop those already in the in-memory cache.
2. Split the rest into chunks of 50 descriptions; one model call per chunk. The sample file has 1000 rows but only 20 distinct descriptions, so it costs one call.
3. The model replies with a JSON array, one label per description, in order. The array is extracted from the reply (code fences or surrounding prose are tolerated).
4. `normaliseCategories` checks the result. A label that is not one of the 10 `CATEGORIES` becomes `FALLBACK_CATEGORY` (Miscellaneous) and is logged as a warning. A wrong label count throws.
5. Unparseable output or a wrong count gets one retry (two attempts), then throws, which becomes a 502.
6. Results are cached by description for the life of the process.

Transport errors (timeouts, 5xx, rate limits) are not retried by our code; the SDK retries them. The client timeout is 30 s.

Only the description is used. In the sample data amount sign and `Transaction Type` disagree on 494 of 1000 rows, so neither is a reliable signal. Consequence: the same description always gets the same Category.

## The prompt

`prompts/categorise.md` is the single source of the runtime prompt; `{{categories}}` is filled from `CATEGORIES`. Descriptions never appear in the system prompt. They go in the user message as a JSON array inside `<descriptions>` tags, and the prompt tells the model they are data, not instructions. As a second line of defence, output validation means the model can only ever produce one of the 10 Categories, whatever a description says. Details: [prompts/README.md](../prompts/README.md).

## Data findings

Checked by script on `data/transaction_history.csv`: 1000 rows, unique ids, no empty fields, 20 distinct descriptions. Amount sign and type disagree on 494 rows, so they are not cross-validated. CSV timestamps have no timezone and are read as UTC. Some descriptions are judgment calls for the model, for example "Municipal Tax Payment", "PayPal Transfer", "Tax Refund", "Payment to Credit Card".

## Trade-offs

Each: what we chose, what we gave up, when to revisit.

| # | Chose | Gave up | Revisit when |
|---|---|---|---|
| 1 | `node:sqlite` (built in) | It is experimental: Node prints an ExperimentalWarning on start. `better-sqlite3` is the alternative but needs a native build | `node:sqlite` is unavailable or unstable. Only `src/repository/sqlite.ts` and `src/db/open.ts` change, because of `TransactionRepository` |
| 2 | SQLite instead of Postgres: no separate DB container | Single writer; one process owns the file | More than one instance, or concurrent write load |
| 3 | `amount` stored as REAL | Floating point is unsafe for money; integer cents would be exact | Amounts are summed or compared, or leave this exercise |
| 4 | Import is all-or-nothing; re-import returns 409, no upsert | A single bad row or duplicate rejects the whole file | Users need partial import with a per-row report, or idempotent re-import |
| 5 | `GET /transactions` returns everything, no pagination | Response grows with the table | Table is large enough to hurt latency or memory |
| 6 | Categorise by description only | Amount and type could disambiguate, but the data is inconsistent | Data is trustworthy, or descriptions are ambiguous per merchant |
| 7 | In-memory, unbounded cache | Resets on restart, so descriptions cost model calls again. Memory grows with distinct descriptions | Many distinct descriptions, or multiple instances (use a shared or persisted cache) |
| 8 | Invalid label falls back to Miscellaneous (logged); wrong label count throws | A bad label silently becomes Miscellaneous, visible only in logs. Count errors fail the request | Fallback rate in logs is high. The count must throw because labels could no longer be matched to descriptions |
| 9 | Duplicate id returns 409; upstream categoriser failure returns 502 with the upstream message hidden | Client cannot see why categorisation failed (details go to the server log) | Clients need retry guidance or error codes |
| 10 | `docker compose` requires `ANTHROPIC_API_KEY` to start, even to read data | Friction for read-only use | Reads and writes need to be split, or a key-less mode is wanted. The upside is a loud failure at start, not at the first write |

Other known gaps: no authentication, no rate limiting, no migrations beyond `CREATE TABLE IF NOT EXISTS`, and `POST /transactions` parses a timestamp without a timezone using JavaScript `Date` rules (assumption: send an explicit offset), unlike the CSV import, which reads it as UTC.

## Known limitations / not yet verified

- The real Anthropic API has not been called (no key was available). Categorisation accuracy, the prompt's behaviour on the 20 sample descriptions, and the model id default are unverified. No accuracy figures are claimed. The categoriser is tested only against a fake model call.
- `docker compose up` has not been run end to end (Compose is not installed on the author's machine). The image was built and run with plain `docker build` and `docker run`.
- Test count (176 across 12 files) is stated; no coverage percentage was measured.
