import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { Categoriser } from "./categoriser/categoriser.js";
import { openDatabase } from "./db/open.js";
import { createSqliteRepository } from "./repository/sqlite.js";

// Real parser, real routes, real SQLite (in memory); only the Categoriser is faked.
const categoriser: Categoriser = {
  categorise: async (ts) => ts.map((t) => (/Albert Heijn|AH /.test(t.description) ? "Groceries" : "Miscellaneous")),
};

const sampleCsv = readFileSync(new URL("../data/transaction_history.csv", import.meta.url), "utf8");

const importSample = (app: ReturnType<typeof createApp>) =>
  app.request("/transactions/import", { method: "POST", headers: { "content-type": "text/csv" }, body: sampleCsv });

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ categoriser, repository: createSqliteRepository(openDatabase(":memory:")) });
});

describe("CSV intake, end to end", () => {
  it("imports the provided file: 1000 rows stored and retrievable", async () => {
    const res = await importSample(app);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ imported: 1000 });

    const list = (await (await app.request("/transactions")).json()) as Array<{ id: string; category: string }>;
    expect(list).toHaveLength(1000);
    expect(new Set(list.map((t) => t.id)).size).toBe(1000);
  });

  it("stores row 1 of the file as the API shape, timestamp in UTC, with its category", async () => {
    await importSample(app);
    const res = await app.request("/transactions/TXN00001");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "TXN00001",
      amount: -87.18,
      timestamp: "2024-05-16T07:22:18.808Z",
      description: "Municipal Tax Payment",
      type: "debit",
      accountNumber: "NLINGB1944573686",
      category: "Miscellaneous",
    });
  });

  it("applies the categoriser's category to the matching rows only", async () => {
    await importSample(app);
    const list = (await (await app.request("/transactions")).json()) as Array<{
      description: string;
      category: string;
    }>;
    for (const t of list) {
      expect(t.category).toBe(/Albert Heijn|AH /.test(t.description) ? "Groceries" : "Miscellaneous");
    }
    expect(list.some((t) => t.category === "Groceries")).toBe(true);
  });

  it("rejects a second import of the same file with 409 and leaves the data unchanged", async () => {
    await importSample(app);
    expect((await importSample(app)).status).toBe(409);
    expect(await (await app.request("/transactions")).json()).toHaveLength(1000);
  });

  it("rejects a file with one bad row as a whole: nothing is stored", async () => {
    const broken = sampleCsv.replace(/^TXN00500,[^,]*/m, "TXN00500,not-a-number");
    const res = await app.request("/transactions/import", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: broken,
    });
    expect(res.status).toBe(400);
    expect(await (await app.request("/transactions")).json()).toEqual([]);
  });
});
