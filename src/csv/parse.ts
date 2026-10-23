import { CsvError, parse } from "csv-parse/sync";
import { parseTimestamp } from "../domain/timestamp.js";
import { TransactionInput } from "../domain/transaction.js";

export type CsvIssue = { row: number; message: string };

/** Thrown when the CSV cannot be turned into TransactionInput[]; lists every problem found. */
export class CsvParseError extends Error {
  constructor(readonly issues: CsvIssue[]) {
    super(`Invalid CSV: ${issues.map((i) => `row ${i.row}: ${i.message}`).join("; ")}`);
    this.name = "CsvParseError";
  }
}

const COLUMNS = {
  id: "Transaction ID",
  amount: "Amount",
  timestamp: "Timestamp",
  description: "Description",
  type: "Transaction Type",
  accountNumber: "Account Number",
} as const;

type Field = keyof typeof COLUMNS;

const AMOUNT = /^-?\d+(\.\d+)?$/;

type CsvRecord = { fields: string[]; row: number };

const readRecords = (csv: string): CsvRecord[] => {
  try {
    // csv-parse's typings do not narrow the result for `info: true`.
    const records = parse(csv, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      info: true,
    } as const) as unknown as Array<{ record: string[]; info: { lines: number } }>;
    return records.map(({ record, info }) => ({ fields: record, row: info.lines }));
  } catch (e) {
    if (e instanceof CsvError) throw new CsvParseError([{ row: typeof e.lines === "number" ? e.lines : 1, message: e.message }]);
    throw e;
  }
};

const locateColumns = ({ fields, row }: CsvRecord): Map<Field, number> => {
  const index = new Map<Field, number>();
  const missing: string[] = [];
  for (const [field, name] of Object.entries(COLUMNS) as Array<[Field, string]>) {
    const at = fields.indexOf(name);
    if (at === -1) missing.push(name);
    else index.set(field, at);
  }
  if (missing.length) {
    throw new CsvParseError([{ row, message: `missing column(s): ${missing.join(", ")}` }]);
  }
  return index;
};

/** Returns the rows of a transaction-history CSV, or throws CsvParseError listing every invalid row. */
export const parseTransactionsCsv = (csv: string): TransactionInput[] => {
  const [header, ...rows] = readRecords(csv);
  if (!header) throw new CsvParseError([{ row: 1, message: "missing header row" }]);

  const column = locateColumns(header);
  const issues: CsvIssue[] = [];
  const firstRowOfId = new Map<string, number>();
  const transactions: TransactionInput[] = [];

  for (const { fields, row } of rows) {
    const fail = (message: string) => void issues.push({ row, message });
    if (fields.length !== header.fields.length) {
      fail(`expected ${header.fields.length} columns, got ${fields.length}`);
      continue;
    }
    const get = (field: Field) => fields[column.get(field)!]!;

    if (!AMOUNT.test(get("amount"))) {
      fail(`Amount must be a decimal number, got "${get("amount")}"`);
      continue;
    }
    const timestamp = parseTimestamp(get("timestamp"));
    if (!timestamp) {
      fail(`Timestamp must look like YYYY-MM-DD HH:MM:SS[.ffffff] (UTC unless an offset is given), got "${get("timestamp")}"`);
      continue;
    }
    const parsed = TransactionInput.safeParse({
      id: get("id"),
      amount: Number(get("amount")),
      timestamp,
      description: get("description"),
      type: get("type"),
      accountNumber: get("accountNumber"),
    });
    if (!parsed.success) {
      fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
      continue;
    }

    const firstRow = firstRowOfId.get(parsed.data.id);
    if (firstRow !== undefined) {
      fail(`duplicate Transaction ID ${parsed.data.id} (first seen on row ${firstRow})`);
      continue;
    }
    firstRowOfId.set(parsed.data.id, row);
    transactions.push(parsed.data);
  }

  if (issues.length) throw new CsvParseError(issues);
  return transactions;
};
