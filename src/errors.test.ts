import { describe, expect, it } from "vitest";
import { summariseError } from "./errors.js";

/** Shaped like @anthropic-ai/sdk's APIError: status, requestID, and a bulky headers object. */
const apiError = () =>
  Object.assign(new Error('400 {"error":{"message":"Your credit balance is too low"}}'), {
    name: "BadRequestError",
    status: 400,
    requestID: "req_123",
    headers: { "anthropic-organization-id": "org-secret-id", "cf-ray": "abc" },
  });

describe("summariseError", () => {
  it("is a single line", () => {
    const error = new Error("line one\nline two\n    at somewhere (file.ts:1:1)");
    expect(summariseError(error)).not.toMatch(/\n/);
  });

  it("names the error type and message", () => {
    expect(summariseError(new TypeError("bad input"))).toBe("TypeError: bad input");
  });

  it("includes status and request id when the error has them", () => {
    const line = summariseError(apiError());
    expect(line).toContain("BadRequestError");
    expect(line).toContain("credit balance is too low");
    expect(line).toContain("status 400");
    expect(line).toContain("request req_123");
  });

  it("never includes headers or the stack", () => {
    const line = summariseError(apiError());
    expect(line).not.toContain("org-secret-id");
    expect(line).not.toContain("cf-ray");
    expect(line).not.toMatch(/\bat \S+ \(/);
  });

  it("follows the cause chain, outermost first", () => {
    const outer = new Error("Categoriser failed", { cause: apiError() });
    const line = summariseError(outer);
    expect(line.indexOf("Categoriser failed")).toBeLessThan(line.indexOf("credit balance"));
    expect(line).toContain("caused by");
  });

  it("stops following a cause chain that loops", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(summariseError(a).length).toBeLessThan(500);
  });

  it.each([["a string", "boom"], ["undefined", undefined], ["null", null], ["an object", { code: 7 }]])(
    "handles a thrown %s",
    (_name, value) => {
      expect(typeof summariseError(value)).toBe("string");
      expect(summariseError(value).length).toBeGreaterThan(0);
    },
  );

  it("truncates a very long message", () => {
    const line = summariseError(new Error("x".repeat(5000)));
    expect(line.length).toBeLessThanOrEqual(501);
    expect(line.endsWith("…")).toBe(true);
  });
});
