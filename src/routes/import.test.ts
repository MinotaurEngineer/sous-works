import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { Categoriser } from "../categoriser/categoriser.js";
import { MAX_CSV_BYTES } from "./import.js";
import type { Transaction } from "../domain/transaction.js";
import {
  DuplicateTransactionError,
  type TransactionRepository,
} from "../repository/transactionRepository.js";

const HEADER = "Transaction ID,Amount,Timestamp,Description,Transaction Type,Account Number";
const line = (id: string, description = "Albert Heijn Purchase") =>
  `${id},-10.00,2024-01-01 08:00:00.000000,${description},debit,NLINGB1`;
const csv = (...ids: string[]) => [HEADER, ...ids.map((id) => line(id))].join("\n");

const importCsv = (body: string, contentType = "text/csv") =>
  app.request("/transactions/import", { method: "POST", headers: { "content-type": contentType }, body });

let saved: Transaction[];
let repository: TransactionRepository;
let categorise: ReturnType<typeof vi.fn<Categoriser["categorise"]>>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  saved = [];
  repository = {
    save: async () => {},
    saveAll: async (ts) => {
      saved.push(...ts);
    },
    list: async () => [],
    get: async () => undefined,
  };
  categorise = vi.fn<Categoriser["categorise"]>(async (ts) => ts.map(() => "Groceries"));
  app = createApp({ categoriser: { categorise }, repository });
});

describe("POST /transactions/import", () => {
  it("categorises and stores every row, returning 201 with the count", async () => {
    const res = await importCsv(csv("A", "B"));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ imported: 2 });
    expect(saved.map((t) => [t.id, t.category])).toEqual([
      ["A", "Groceries"],
      ["B", "Groceries"],
    ]);
  });

  it("maps each category to its own row, in file order", async () => {
    categorise.mockResolvedValueOnce(["Housing", "Utilities"]);
    await importCsv(csv("A", "B"));
    expect(saved.map((t) => [t.id, t.category])).toEqual([
      ["A", "Housing"],
      ["B", "Utilities"],
    ]);
  });

  it("calls the categoriser once with all rows (batching is the categoriser's concern)", async () => {
    await importCsv(csv("A", "B", "C"));
    expect(categorise).toHaveBeenCalledOnce();
    expect(categorise.mock.calls[0]?.[0].map((t) => t.id)).toEqual(["A", "B", "C"]);
  });

  it("accepts a content type with a charset parameter", async () => {
    expect((await importCsv(csv("A"), "text/csv; charset=utf-8")).status).toBe(201);
  });

  it("returns 415 for another content type and does nothing", async () => {
    const res = await importCsv(csv("A"), "application/json");
    expect(res.status).toBe(415);
    expect(categorise).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("returns 413 when the body exceeds MAX_CSV_BYTES and does nothing", async () => {
    const res = await importCsv("x".repeat(MAX_CSV_BYTES + 1));
    expect(res.status).toBe(413);
    expect(categorise).not.toHaveBeenCalled();
  });

  it("returns 400 with the issues for an invalid CSV; categoriser and repository untouched", async () => {
    const bad = `${HEADER}\n${line("A")}\nB,abc,2024-01-01 08:00:00,x,debit,NL1`;
    const res = await importCsv(bad);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid CSV",
      total: 1,
      issues: [{ row: 3, message: expect.stringMatching(/amount/i) }],
    });
    expect(categorise).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("caps the issues in the response at 20 but reports the total", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => `T${i},abc,2024-01-01 08:00:00,x,debit,NL1`);
    const body = (await (await importCsv([HEADER, ...rows].join("\n"))).json()) as {
      total: number;
      issues: unknown[];
    };
    expect(body.total).toBe(30);
    expect(body.issues).toHaveLength(20);
  });

  it("returns 400 for a CSV with a header but no transactions", async () => {
    const res = await importCsv(`${HEADER}\n`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "CSV contains no transactions" });
    expect(categorise).not.toHaveBeenCalled();
  });

  it("returns 409 when an id is already stored", async () => {
    repository.saveAll = async () => {
      throw new DuplicateTransactionError();
    };
    expect((await importCsv(csv("A"))).status).toBe(409);
  });

  it("returns 502 and stores nothing when the categoriser fails, without leaking its message", async () => {
    categorise.mockRejectedValueOnce(new Error("sk-secret-key rejected"));
    const res = await importCsv(csv("A"));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("sk-secret-key");
    expect(saved).toEqual([]);
  });

  it("returns 502 and stores nothing when the categoriser breaks its contract (wrong count)", async () => {
    categorise.mockResolvedValueOnce(["Groceries"]);
    const res = await importCsv(csv("A", "B"));
    expect(res.status).toBe(502);
    expect(saved).toEqual([]);
  });

  it("returns 500 when the repository fails", async () => {
    repository.saveAll = async () => {
      throw new Error("db down");
    };
    expect((await importCsv(csv("A"))).status).toBe(500);
  });
});
