import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { CATEGORIES } from "./domain/categories.js";

const app = createApp({
  categoriser: { categorise: async (t) => t.map(() => "Miscellaneous") },
  repository: { save: async () => {}, list: async () => [], get: async () => undefined },
});

describe("app", () => {
  it("reports health", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("categories", () => {
  it("has the 10 predefined categories", () => {
    expect(CATEGORIES).toHaveLength(10);
  });
});
