import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTransactionsCsv } from "./parse.js";

const HEADER = "Transaction ID,Amount,Timestamp,Description,Transaction Type,Account Number";
const ROW1 = "TXN00001,-87.18,2024-05-16 07:22:18.808433,Municipal Tax Payment,debit,NLINGB1944573686";

const realCsv = readFileSync(new URL("../../data/transaction_history.csv", import.meta.url), "utf8");

describe("parseTransactionsCsv: the provided file", () => {
  const rows = () => parseTransactionsCsv(realCsv);

  it("parses all 1000 rows", () => {
    expect(rows()).toHaveLength(1000);
  });

  it("has unique transaction ids", () => {
    expect(new Set(rows().map((r) => r.id)).size).toBe(1000);
  });

  it("maps the first row to the TransactionInput shape", () => {
    expect(rows()[0]).toEqual({
      id: "TXN00001",
      amount: -87.18,
      timestamp: new Date("2024-05-16T07:22:18.808Z"),
      description: "Municipal Tax Payment",
      type: "debit",
      accountNumber: "NLINGB1944573686",
    });
  });
});

describe("parseTransactionsCsv: timestamps", () => {
  it("treats timezone-less timestamps as UTC, independent of the host timezone", () => {
    const [row] = parseTransactionsCsv(`${HEADER}\n${ROW1}\n`);
    expect(row?.timestamp.toISOString()).toBe("2024-05-16T07:22:18.808Z");
  });
});

describe("parseTransactionsCsv: errors", () => {
  it("returns no rows for a header-only file", () => {
    expect(parseTransactionsCsv(`${HEADER}\n`)).toEqual([]);
  });

  it("throws when a required column is missing, naming it", () => {
    const csv = "Transaction ID,Amount,Timestamp,Description,Transaction Type\nTXN1,1,2024-01-01 00:00:00,x,debit\n";
    expect(() => parseTransactionsCsv(csv)).toThrow(/Account Number/);
  });

  it("throws on an invalid row, naming the row number (header is row 1)", () => {
    const bad = "TXN00002,abc,2024-01-01 00:00:00.000000,Rent Payment,debit,NLINGB1";
    expect(() => parseTransactionsCsv(`${HEADER}\n${ROW1}\n${bad}\n`)).toThrow(/row 3/i);
  });

  it("throws on duplicate transaction ids, naming the id", () => {
    expect(() => parseTransactionsCsv(`${HEADER}\n${ROW1}\n${ROW1}\n`)).toThrow(/TXN00001/);
  });
});
