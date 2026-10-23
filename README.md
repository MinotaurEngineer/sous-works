# Transaction Categoriser

API that accepts banking transactions, categorises each into one of 10 predefined categories using an LLM (Anthropic API), stores them in SQLite and serves them back. Built for the assessment in `brief/Senior_Engineer_Assessment_SOUS.pdf`.

Stack: TypeScript, Hono, Node >= 22, built-in `node:sqlite`, zod, csv-parse, `@anthropic-ai/sdk`. Reasoning is in [docs/design.md](docs/design.md).

## Run with Docker

Requires Docker with Compose and an Anthropic API key.

```
cp .env.example .env        # then set ANTHROPIC_API_KEY in .env
docker compose up --build
```

The API listens on http://localhost:3000. Data is kept in the named volume `dbdata`, mounted at `/data` (`DATABASE_PATH=/data/app.db`). `docker compose down -v` deletes it.

Compose refuses to start without `ANTHROPIC_API_KEY`, even if you only want to read data.

## Try it

```
# Import the sample file (1000 rows, categorised with one model call)
curl -X POST localhost:3000/transactions/import \
  -H 'Content-Type: text/csv' --data-binary @data/transaction_history.csv

curl localhost:3000/transactions
curl localhost:3000/transactions/TXN00001

curl -X POST localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{"id":"TXN90001","amount":-12.5,"timestamp":"2024-05-16T07:22:18Z","description":"Netflix Subscription","type":"debit","accountNumber":"NLINGB1944573686"}'
```

Importing the same file twice returns 409 (no upsert). Full request and response details: [docs/api.md](docs/api.md).

## Configuration

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | none | Anthropic API key. Startup fails if missing |
| `ANTHROPIC_MODEL` | no | `claude-haiku-5-5` | Model used for categorisation |
| `PORT` | no | `3000` | HTTP port |
| `DATABASE_PATH` | no | `./data/app.db` | SQLite file (`/data/app.db` in the Docker image) |

Invalid values stop the process at startup with every offending variable named.

## Development

Needs Node >= 22.

```
npm install
npm test                       # vitest run; needs no API key and no network
ANTHROPIC_API_KEY=... npm run dev   # tsx watch src/index.ts
npm run build && npm start     # compiled output in dist/
```

Layout:

| Path | Contents |
|---|---|
| `src/domain` | `CATEGORIES`, `TransactionInput`, `Transaction` |
| `src/categoriser` | `Categoriser` interface, `categoriseTransactions`, `normaliseCategories`, Anthropic implementation, prompt loading |
| `src/csv` | `parseTransactionsCsv`, `CsvParseError` |
| `src/repository` | `TransactionRepository` and its SQLite implementation |
| `src/routes`, `src/app.ts` | HTTP routes and app wiring |
| `prompts/categorise.md` | Runtime prompt, the single source |

Tests (`npm test`) cover config loading, domain validation and timestamp parsing, CSV parsing, normalisation, the categorise step, the Anthropic categoriser (batching, cache, retry, with a fake model call), the SQLite repository, each route, and an end-to-end import. They use a fake `Categoriser` or fake model call, so no test contacts the Anthropic API.

## Verification status

- Unit and integration tests: all pass (`npm test`).
- Docker: the image was built and run with plain `docker build` and `docker run`. `docker compose up` has not been run end to end, because Compose is not installed on the author's machine. `docker-compose.yml` is therefore untested.
- The real Anthropic API has not been called (no key was available), so categorisation accuracy is unverified. See "Known limitations" in [docs/design.md](docs/design.md).

## Docs

- [API](docs/api.md)
- [Design and trade-offs](docs/design.md)
- [Prompts](prompts/README.md)
