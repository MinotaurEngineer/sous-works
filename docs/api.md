# API

Base URL `http://localhost:3000`. Requests and responses are JSON unless stated.

| Method | Path | Purpose |
|---|---|---|
| POST | `/transactions` | Submit a transaction; returns it with its category |
| GET | `/transactions` | List all categorised transactions |
| GET | `/transactions/:id` | Get one transaction |
| POST | `/transactions/import` | Import a transaction-history CSV; every row is categorised and stored |
| GET | `/health` | Liveness |

## Transaction

| Field | Type | Notes |
|---|---|---|
| `id` | string | Non-empty, unique |
| `amount` | integer | **Cents** (EUR minor units), as Stripe does: `-8718` is -87.18. A decimal such as `-87.18`, a string, or a value beyond ±9007199254740991 is rejected with 400. Sign is not checked against `type` |
| `timestamp` | string | Output: ISO 8601 in UTC with `Z`. Input: `YYYY-MM-DDTHH:MM:SS[.fff]` followed by an optional `Z` or `±HH:MM` (a space may replace `T`). **No offset means UTC**, the same rule as the CSV import. Offsets are converted to UTC. Other formats and impossible dates (for example 2024-02-30) are rejected with 400 |
| `description` | string | Non-empty. The only field used for categorisation |
| `type` | `"debit"` or `"credit"` | |
| `accountNumber` | string | Non-empty |
| `category` | string | Output only. One of: Groceries, Dining Out, Utilities, Transportation, Entertainment, Healthcare, Shopping, Housing, Education, Miscellaneous. A `category` sent by the client is ignored |

Input is a TransactionInput (the fields above without `category`); output is a Transaction.

## GET /health

```
curl localhost:3000/health
```

200 `{"status":"ok"}`

## POST /transactions

Validates the body, categorises it, stores it and returns it. Body max 16 KiB.

```
curl -X POST localhost:3000/transactions -H 'Content-Type: application/json' \
  -d '{"id":"TXN90001","amount":-1250,"timestamp":"2024-05-16T07:22:18Z","description":"Netflix Subscription","type":"debit","accountNumber":"NLINGB1944573686"}'
```

```
{"id":"TXN90001","amount":-1250,"timestamp":"2024-05-16T07:22:18.000Z","description":"Netflix Subscription","type":"debit","accountNumber":"NLINGB1944573686","category":"Entertainment"}
```

(The `category` shown is illustrative; it comes from the model.)

| Status | Body | When |
|---|---|---|
| 201 | the stored Transaction | Categorised and stored |
| 400 | `{"error": "Invalid transaction", "issues": [{"path": "amount", "message": "..."}]}` | Body fails validation. One issue per invalid field |
| 400 | `{"error": "Body must be valid JSON"}` | Malformed JSON (no `issues`) |
| 409 | `{"error": "Transaction id already exists"}` | Duplicate `id`; the original is kept |
| 413 | `{"error": "Body too large"}` | Body over 16 KiB |
| 502 | `{"error": "Categorisation failed"}` | The categoriser failed or returned the wrong number of categories. Nothing is stored. The upstream message is not exposed |
| 500 | framework default error | Repository failure other than a duplicate |

## GET /transactions

All stored transactions as a JSON array, ordered by `timestamp` then `id`. No pagination or filtering. Empty store returns `[]`. Does not call the categoriser.

```
curl localhost:3000/transactions
```

| Status | When |
|---|---|
| 200 | Array of Transactions |
| 500 | Repository failure |

## GET /transactions/:id

```
curl localhost:3000/transactions/TXN00001
```

| Status | Body | When |
|---|---|---|
| 200 | the Transaction | Found |
| 404 | `{"error": "Transaction not found"}` | Unknown id |
| 500 | framework default error | Repository failure |

## POST /transactions/import

Body is the CSV itself, sent with `Content-Type: text/csv` (max 5 MiB):

```
curl -X POST localhost:3000/transactions/import \
  -H 'Content-Type: text/csv' --data-binary @data/transaction_history.csv
```

Required columns (any order, extra columns ignored):
`Transaction ID, Amount, Timestamp, Description, Transaction Type, Account Number`.
Timestamps are read as UTC unless they carry an offset (same parser as `POST /transactions`). `Transaction Type` is `debit` or `credit`.
Here `Amount` is a **decimal in euros** (`-87.18`, `170.7`, `100`), the only place decimals are accepted. The import converts it to integer cents by parsing the text, never by multiplying a float (47 of the 1000 sample amounts, such as `-309.34`, would be off by one cent that way). More than 2 decimals, an exponent, a thousands separator or a value beyond the safe integer range is an invalid row: amounts are never rounded.
Amount sign and type are not cross-validated: 494 of the 1000 sample rows disagree.

The import is all or nothing: if any row is invalid or any id already exists, nothing is stored. Re-importing the same file returns 409.

| Status | Body | When |
|---|---|---|
| 201 | `{"imported": 1000}` | Every row categorised and stored |
| 400 | `{"error": "Invalid CSV", "total": n, "issues": [{"row": 3, "message": "..."}]}` | Invalid rows. Row 1 is the header. At most 20 issues are listed; `total` is the full count |
| 400 | `{"error": "CSV contains no transactions"}` | Header only |
| 409 | `{"error": "One or more transaction ids already exist"}` | Duplicate id against stored data |
| 413 | `{"error": "CSV too large"}` | Body over 5 MiB |
| 415 | `{"error": "Content-Type must be text/csv"}` | Wrong content type |
| 502 | `{"error": "Categorisation failed"}` | The categoriser failed or returned the wrong number of categories |
