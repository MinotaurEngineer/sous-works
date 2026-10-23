# API

| Method | Path | Purpose |
|---|---|---|
| POST | `/transactions` | Submit a transaction; returns it with its category |
| GET | `/transactions` | List all categorised transactions |
| GET | `/transactions/:id` | Get one transaction |
| POST | `/transactions/import` | Import a transaction-history CSV; every row is categorised and stored |
| GET | `/health` | Liveness |

## POST /transactions/import

Body is the CSV itself, sent with `Content-Type: text/csv` (max 5 MiB):

```
curl -X POST localhost:3000/transactions/import \
  -H 'Content-Type: text/csv' --data-binary @data/transaction_history.csv
```

Required columns (any order, extra columns ignored):
`Transaction ID, Amount, Timestamp, Description, Transaction Type, Account Number`.
Timestamps have no timezone and are read as UTC. `Transaction Type` is `debit` or `credit`.
Amount sign and type are not cross-validated: 494 of the 1000 sample rows disagree.

The import is all or nothing: if any row is invalid or any id already exists, nothing is stored.

| Status | Body | When |
|---|---|---|
| 201 | `{"imported": 1000}` | Every row categorised and stored |
| 400 | `{"error": "Invalid CSV", "total": n, "issues": [{"row": 3, "message": "..."}]}` | Invalid rows. Row 1 is the header. At most 20 issues are listed; `total` is the full count |
| 400 | `{"error": "CSV contains no transactions"}` | Header only |
| 409 | `{"error": "One or more transaction ids already exist"}` | Duplicate id against stored data |
| 413 | `{"error": "CSV too large"}` | Body over 5 MiB |
| 415 | `{"error": "Content-Type must be text/csv"}` | Wrong content type |
| 502 | `{"error": "Categorisation failed"}` | The categoriser failed or returned the wrong number of categories |

TODO: request/response schemas for the other endpoints.
