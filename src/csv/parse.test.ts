import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CsvParseError, parseTransactionsCsv } from "./parse.js";

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

  it("converts every amount to the exact integer number of cents written in the file", () => {
    const texts = realCsv.trim().split("\n").slice(1).map((line) => line.split(",")[1]!);
    expect(rows()).toHaveLength(texts.length);
    rows().forEach((r, i) => {
      expect(Number.isInteger(r.amount)).toBe(true);
      // Math.round(float * 100) is a safe oracle for the 1-2 decimal amounts in this file.
      expect(r.amount).toBe(Math.round(Number(texts[i]) * 100));
    });
  });

  it("maps the first row to the TransactionInput shape", () => {
    expect(rows()[0]).toEqual({
      id: "TXN00001",
      amount: -8718,
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

const row = (id: string, overrides: Partial<Record<string, string>> = {}) => {
  const f = {
    amount: "-1.50",
    timestamp: "2024-01-01 00:00:00.000000",
    description: "Rent Payment",
    type: "debit",
    account: "NLINGB1",
    ...overrides,
  };
  return `${id},${f.amount},${f.timestamp},${f.description},${f.type},${f.account}`;
};

const issuesOf = (csv: string) => {
  try {
    parseTransactionsCsv(csv);
  } catch (e) {
    expect(e).toBeInstanceOf(CsvParseError);
    return (e as CsvParseError).issues;
  }
  throw new Error("expected parseTransactionsCsv to throw");
};

describe("parseTransactionsCsv: errors", () => {
  it("returns no rows for a header-only file", () => {
    expect(parseTransactionsCsv(`${HEADER}\n`)).toEqual([]);
  });

  it("throws CsvParseError for empty input: there is no header", () => {
    expect(issuesOf("")).toEqual([{ row: 1, message: expect.stringMatching(/header/i) }]);
  });

  it("throws when a required column is missing, naming it (row 1)", () => {
    const csv = "Transaction ID,Amount,Timestamp,Description,Transaction Type\nTXN1,1,2024-01-01 00:00:00,x,debit\n";
    expect(issuesOf(csv)).toEqual([{ row: 1, message: expect.stringContaining("Account Number") }]);
  });

  it("names the row number of an invalid row (header is row 1)", () => {
    const csv = `${HEADER}\n${ROW1}\n${row("TXN00002", { amount: "abc" })}\n`;
    expect(issuesOf(csv)).toEqual([{ row: 3, message: expect.stringMatching(/amount/i) }]);
  });

  it("reports every invalid row, not just the first", () => {
    const csv = [HEADER, row("A", { type: "refund" }), row("B"), row("C", { description: "" })].join("\n");
    expect(issuesOf(csv).map((i) => i.row)).toEqual([2, 4]);
  });

  it("names the second occurrence of a duplicate id and the id", () => {
    expect(issuesOf(`${HEADER}\n${ROW1}\n${ROW1}\n`)).toEqual([
      { row: 3, message: expect.stringContaining("TXN00001") },
    ]);
  });

  it.each([
    ["empty amount", { amount: "" }],
    ["non-numeric amount", { amount: "12,5" }],
    ["exponent amount", { amount: "1e3" }],
    ["amount needing rounding (3 decimals)", { amount: "1.234" }],
    ["amount beyond a safe integer of cents", { amount: "90071992547409.92" }],
    ["unparseable timestamp", { timestamp: "yesterday" }],
    ["impossible date", { timestamp: "2024-02-30 00:00:00" }],
    ["timestamp with date only", { timestamp: "2024-01-01" }],
    ["unknown type", { type: "refund" }],
    ["empty id", { id: "" }],
  ])("rejects %s", (_name, override) => {
    const { id = "TXN1", ...rest } = override as Record<string, string>;
    const issues = issuesOf(`${HEADER}\n${row(id, rest)}\n`);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.row).toBe(2);
  });

  it("throws CsvParseError when a row has the wrong number of columns", () => {
    expect(issuesOf(`${HEADER}\nTXN1,1,2024-01-01 00:00:00,x,debit\n`)[0]?.row).toBe(2);
  });

  it("message lists the issues so a plain log line is useful", () => {
    const csv = `${HEADER}\n${row("A", { amount: "abc" })}\n`;
    expect(() => parseTransactionsCsv(csv)).toThrow(/row 2.*amount/i);
  });
});

describe("parseTransactionsCsv: tolerated variations", () => {
  it("accepts a timestamp without fractional seconds", () => {
    const [r] = parseTransactionsCsv(`${HEADER}\n${row("A", { timestamp: "2024-01-01 10:20:30" })}\n`);
    expect(r?.timestamp.toISOString()).toBe("2024-01-01T10:20:30.000Z");
  });

  it.each([["170.7", 17070], ["-309.34", -30934], ["1.15", 115], ["100", 10000], ["-0", 0]])(
    "reads amount %s as %i cents",
    (amount, cents) => {
      expect(parseTransactionsCsv(`${HEADER}\n${row("A", { amount })}\n`)[0]?.amount).toBe(cents);
    },
  );

  it("says what an invalid amount should look like", () => {
    const [issue] = issuesOf(`${HEADER}\n${row("A", { amount: "1.234" })}\n`);
    expect(issue?.message).toMatch(/at most 2 decimal/i);
  });

  it("keeps a quoted description containing a comma", () => {
    const [r] = parseTransactionsCsv(`${HEADER}\n${row("A", { description: '"Bol.com, Utrecht"' })}\n`);
    expect(r?.description).toBe("Bol.com, Utrecht");
  });

  it("handles a BOM, CRLF line endings and blank lines", () => {
    const csv = `\uFEFF${HEADER}\r\n${row("A")}\r\n\r\n${row("B")}\r\n`;
    expect(parseTransactionsCsv(csv).map((r) => r.id)).toEqual(["A", "B"]);
  });

  it("ignores extra columns and column order", () => {
    const csv = "Extra,Account Number,Transaction Type,Description,Timestamp,Amount,Transaction ID\nx,NL1,credit,Salary,2024-01-01 00:00:00,10,A\n";
    expect(parseTransactionsCsv(csv)).toEqual([
      {
        id: "A",
        amount: 1000,
        timestamp: new Date("2024-01-01T00:00:00.000Z"),
        description: "Salary",
        type: "credit",
        accountNumber: "NL1",
      },
    ]);
  });
});
