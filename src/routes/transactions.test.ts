import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { MAX_TRANSACTION_BYTES } from "./transactions.js";
import type { Categoriser } from "../categoriser/categoriser.js";
import type { Transaction } from "../domain/transaction.js";
import {
  DuplicateTransactionError,
  type TransactionRepository,
} from "../repository/transactionRepository.js";

const body = {
  id: "TXN00001",
  amount: -8718,
  timestamp: "2024-05-16T07:22:18.808Z",
  description: "Albert Heijn Purchase",
  type: "debit",
  accountNumber: "NLINGB1944573686",
};

const post = (app: ReturnType<typeof createApp>, payload: unknown) =>
  app.request("/transactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

const stored = (overrides: Partial<Transaction> = {}): Transaction => ({
  ...body,
  timestamp: new Date(body.timestamp),
  type: "debit",
  category: "Groceries",
  ...overrides,
});

let store: Map<string, Transaction>;
let repository: TransactionRepository;
let categorise: ReturnType<typeof vi.fn<Categoriser["categorise"]>>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = new Map();
  repository = {
    save: async (t) => {
      if (store.has(t.id)) throw new DuplicateTransactionError();
      store.set(t.id, t);
    },
    saveAll: async (ts) => {
      for (const t of ts) await repository.save(t);
    },
    list: async () => [...store.values()],
    get: async (id) => store.get(id),
  };
  categorise = vi.fn<Categoriser["categorise"]>(async (ts) => ts.map(() => "Groceries"));
  app = createApp({ categoriser: { categorise }, repository });
});

describe("POST /transactions", () => {
  it("categorises, stores and returns 201 with the category", async () => {
    const res = await post(app, body);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...body, category: "Groceries" });
    expect(store.get("TXN00001")?.category).toBe("Groceries");
  });

  it("sends the validated transaction to the categoriser exactly once", async () => {
    await post(app, body);
    expect(categorise).toHaveBeenCalledOnce();
    expect(categorise.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("returns 400 for an invalid body and never calls the categoriser", async () => {
    const res = await post(app, { ...body, type: "refund" });
    expect(res.status).toBe(400);
    expect(categorise).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it("returns 400 for malformed JSON", async () => {
    expect((await post(app, "{not json")).status).toBe(400);
  });

  it("returns 409 for a duplicate id and keeps the original", async () => {
    await post(app, body);
    categorise.mockResolvedValueOnce(["Shopping"]);
    const res = await post(app, { ...body, description: "other" });
    expect(res.status).toBe(409);
    expect(store.get("TXN00001")?.category).toBe("Groceries");
  });

  it("returns 502 and stores nothing when the categoriser fails", async () => {
    categorise.mockRejectedValueOnce(new Error("upstream down"));
    const res = await post(app, body);
    expect(res.status).toBe(502);
    expect(store.size).toBe(0);
  });

  it("logs a categoriser failure as one line, without headers or ids", async () => {
    const upstream = Object.assign(new Error("400 credit balance too low"), {
      status: 400,
      requestID: "req_9",
      headers: { "anthropic-organization-id": "org-secret-id" },
    });
    categorise.mockRejectedValueOnce(upstream);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await post(app, body);
      expect(log).toHaveBeenCalledOnce();
      const [line, ...rest] = log.mock.calls[0]!;
      expect(rest).toEqual([]);
      expect(typeof line).toBe("string");
      expect(line).toContain("credit balance too low");
      expect(line).toContain("req_9");
      expect(line).not.toContain("org-secret-id");
    } finally {
      log.mockRestore();
    }
  });

  it("does not leak the upstream error message to the client", async () => {
    categorise.mockRejectedValueOnce(new Error("sk-secret-key rejected"));
    const res = await post(app, body);
    expect(await res.text()).not.toContain("sk-secret-key");
  });
});

describe("POST /transactions: input handling", () => {
  it("names each invalid field in a 400 body", async () => {
    const res = await post(app, { ...body, type: "refund", amount: "x" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; issues: Array<{ path: string; message: string }> };
    expect(json.error).toBe("Invalid transaction");
    expect(json.issues.map((i) => i.path).sort()).toEqual(["amount", "type"]);
  });

  it("rejects a decimal amount with 400 instead of misreading it as cents", async () => {
    const res = await post(app, { ...body, amount: -87.18 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      issues: [{ path: "amount", message: "amount must be an integer number of cents (EUR minor units)" }],
    });
    expect(store.size).toBe(0);
  });

  it("reads a timestamp without an offset as UTC, like the CSV import", async () => {
    const res = await post(app, { ...body, timestamp: "2024-05-16T07:22:18" });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { timestamp: string }).timestamp).toBe("2024-05-16T07:22:18.000Z");
  });

  it("rejects an impossible date with 400", async () => {
    expect((await post(app, { ...body, timestamp: "2024-02-30T00:00:00Z" })).status).toBe(400);
  });

  it("explains a missing timestamp instead of a type-system message", async () => {
    const { timestamp: _omitted, ...withoutTimestamp } = body;
    const res = await post(app, withoutTimestamp);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      issues: [{ path: "timestamp", message: "timestamp must be an ISO 8601 date-time" }],
    });
  });

  it("ignores a client-supplied category: only the categoriser decides", async () => {
    const res = await post(app, { ...body, category: "Housing" });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { category: string }).category).toBe("Groceries");
    expect(categorise.mock.calls[0]?.[0][0]).not.toHaveProperty("category");
  });

  it.each([["an array", []], ["null", null], ["a string", "hello"], ["an empty object", {}]])(
    "returns 400 when the JSON body is %s",
    async (_name, payload) => {
      expect((await post(app, JSON.stringify(payload))).status).toBe(400);
      expect(categorise).not.toHaveBeenCalled();
    },
  );

  it("returns 413 when the body exceeds MAX_TRANSACTION_BYTES", async () => {
    const res = await post(app, { ...body, description: "x".repeat(MAX_TRANSACTION_BYTES) });
    expect(res.status).toBe(413);
    expect(categorise).not.toHaveBeenCalled();
  });

  it("returns 502 and stores nothing when the categoriser breaks its contract (wrong count)", async () => {
    categorise.mockResolvedValueOnce(["Groceries", "Housing"]);
    expect((await post(app, body)).status).toBe(502);
    expect(store.size).toBe(0);
  });

  it("returns 500 when the repository fails for a reason other than a duplicate", async () => {
    repository.save = async () => {
      throw new Error("db down");
    };
    expect((await post(app, body)).status).toBe(500);
  });
});

describe("GET /transactions", () => {
  it("returns an empty list when there are none", async () => {
    const res = await app.request("/transactions");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns all categorised transactions", async () => {
    await repository.save(stored({ id: "TXN00001" }));
    await repository.save(stored({ id: "TXN00002", category: "Housing" }));
    const res = await app.request("/transactions");
    expect(res.status).toBe(200);
    const list = (await res.json()) as Array<{ id: string; category: string }>;
    expect(list.map((t) => [t.id, t.category])).toEqual([
      ["TXN00001", "Groceries"],
      ["TXN00002", "Housing"],
    ]);
  });

  it("serialises each transaction in the API shape, timestamp as ISO 8601", async () => {
    await repository.save(stored());
    const res = await app.request("/transactions");
    expect(await res.json()).toEqual([{ ...body, category: "Groceries" }]);
  });

  it("does not call the categoriser", async () => {
    await repository.save(stored());
    await app.request("/transactions");
    expect(categorise).not.toHaveBeenCalled();
  });

  it("returns 500 when the repository fails", async () => {
    repository.list = async () => {
      throw new Error("db down");
    };
    expect((await app.request("/transactions")).status).toBe(500);
  });
});

describe("GET /transactions/:id", () => {
  it("returns the transaction", async () => {
    await repository.save(stored());
    const res = await app.request("/transactions/TXN00001");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...body, category: "Groceries" });
  });

  it("returns only the requested transaction", async () => {
    await repository.save(stored({ id: "TXN00001" }));
    await repository.save(stored({ id: "TXN00002", category: "Housing" }));
    const res = await app.request("/transactions/TXN00002");
    expect(await res.json()).toMatchObject({ id: "TXN00002", category: "Housing" });
  });

  it("returns 404 with a JSON error for an unknown id", async () => {
    const res = await app.request("/transactions/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Transaction not found" });
  });

  it("decodes a percent-encoded id before lookup", async () => {
    await repository.save(stored({ id: "a b/c" }));
    const res = await app.request(`/transactions/${encodeURIComponent("a b/c")}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "a b/c" });
  });

  it("does not call the categoriser", async () => {
    await repository.save(stored());
    await app.request("/transactions/TXN00001");
    expect(categorise).not.toHaveBeenCalled();
  });

  it("returns 500 when the repository fails", async () => {
    repository.get = async () => {
      throw new Error("db down");
    };
    expect((await app.request("/transactions/TXN00001")).status).toBe(500);
  });
});
