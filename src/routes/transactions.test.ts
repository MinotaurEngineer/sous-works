import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { Categoriser } from "../categoriser/categoriser.js";
import type { Transaction } from "../domain/transaction.js";
import type { TransactionRepository } from "../repository/transactionRepository.js";

const body = {
  id: "TXN00001",
  amount: -87.18,
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

let store: Map<string, Transaction>;
let repository: TransactionRepository;
let categorise: ReturnType<typeof vi.fn<Categoriser["categorise"]>>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  store = new Map();
  repository = {
    save: async (t) => {
      if (store.has(t.id)) throw new Error("duplicate");
      store.set(t.id, t);
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

  it("does not leak the upstream error message to the client", async () => {
    categorise.mockRejectedValueOnce(new Error("sk-secret-key rejected"));
    const res = await post(app, body);
    expect(await res.text()).not.toContain("sk-secret-key");
  });
});

describe("GET /transactions", () => {
  it("returns an empty list when there are none", async () => {
    const res = await app.request("/transactions");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns all categorised transactions", async () => {
    await post(app, body);
    await post(app, { ...body, id: "TXN00002" });
    const res = await app.request("/transactions");
    const list = (await res.json()) as Array<{ id: string; category: string }>;
    expect(list.map((t) => t.id).sort()).toEqual(["TXN00001", "TXN00002"]);
    expect(list.every((t) => t.category === "Groceries")).toBe(true);
  });
});

describe("GET /transactions/:id", () => {
  it("returns the transaction", async () => {
    await post(app, body);
    const res = await app.request("/transactions/TXN00001");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...body, category: "Groceries" });
  });

  it("returns 404 for an unknown id", async () => {
    expect((await app.request("/transactions/nope")).status).toBe(404);
  });
});
