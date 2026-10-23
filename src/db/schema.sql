CREATE TABLE IF NOT EXISTS transactions (
  id             TEXT PRIMARY KEY,
  amount         INTEGER NOT NULL, -- cents (EUR minor units)
  timestamp      TEXT NOT NULL, -- ISO 8601, UTC
  description    TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  account_number TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN (
    'Groceries', 'Dining Out', 'Utilities', 'Transportation', 'Entertainment',
    'Healthcare', 'Shopping', 'Housing', 'Education', 'Miscellaneous'
  ))
) STRICT;
