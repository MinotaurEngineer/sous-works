import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";

const valid = { ANTHROPIC_API_KEY: "key-123" };

const failure = (env: NodeJS.ProcessEnv): ZodError => {
  try {
    loadConfig(env);
  } catch (e) {
    expect(e).toBeInstanceOf(ZodError);
    return e as ZodError;
  }
  throw new Error("expected loadConfig to throw");
};
const offending = (env: NodeJS.ProcessEnv) => failure(env).issues.map((i) => i.path[0]);

afterEach(() => vi.unstubAllEnvs());

describe("loadConfig: defaults and overrides", () => {
  it("needs only the API key; everything else has a default", () => {
    expect(loadConfig(valid)).toEqual({
      ANTHROPIC_API_KEY: "key-123",
      ANTHROPIC_MODEL: "claude-haiku-5-5",
      PORT: 3000,
      DATABASE_PATH: "./data/app.db",
    });
  });

  it("takes every value from the environment when given", () => {
    expect(
      loadConfig({ ...valid, ANTHROPIC_MODEL: "m-2", PORT: "8080", DATABASE_PATH: "/data/app.db" }),
    ).toEqual({ ANTHROPIC_API_KEY: "key-123", ANTHROPIC_MODEL: "m-2", PORT: 8080, DATABASE_PATH: "/data/app.db" });
  });

  it("converts PORT from a string to a number", () => {
    expect(loadConfig({ ...valid, PORT: "8080" }).PORT).toBe(8080);
  });

  it("returns only its own variables, not the rest of the environment", () => {
    expect(Object.keys(loadConfig({ ...valid, PATH: "/bin", HOME: "/home/x" })).sort()).toEqual([
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_MODEL",
      "DATABASE_PATH",
      "PORT",
    ]);
  });

  it("reads process.env when no argument is given", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "from-process");
    expect(loadConfig().ANTHROPIC_API_KEY).toBe("from-process");
  });
});

describe("loadConfig: invalid input fails at startup, naming the variable", () => {
  it("rejects a missing API key", () => {
    expect(offending({})).toEqual(["ANTHROPIC_API_KEY"]);
  });

  it("rejects an empty API key (an unset .env line)", () => {
    expect(offending({ ANTHROPIC_API_KEY: "" })).toEqual(["ANTHROPIC_API_KEY"]);
  });

  it.each([["abc"], [""], ["0"], ["-1"], ["3000.5"], ["65536"], ["1e9"]])("rejects PORT %j", (PORT) => {
    expect(offending({ ...valid, PORT })).toEqual(["PORT"]);
  });

  it.each([["1"], ["65535"]])("accepts the edge port %s", (PORT) => {
    expect(loadConfig({ ...valid, PORT }).PORT).toBe(Number(PORT));
  });

  it("rejects an empty DATABASE_PATH or ANTHROPIC_MODEL instead of using the default", () => {
    expect(offending({ ...valid, DATABASE_PATH: "" })).toEqual(["DATABASE_PATH"]);
    expect(offending({ ...valid, ANTHROPIC_MODEL: "" })).toEqual(["ANTHROPIC_MODEL"]);
  });

  it("reports every offending variable at once, not just the first", () => {
    expect(offending({ PORT: "abc", DATABASE_PATH: "" }).sort()).toEqual([
      "ANTHROPIC_API_KEY",
      "DATABASE_PATH",
      "PORT",
    ]);
  });

  it("does not echo the API key into the error message when another variable is invalid", () => {
    expect(failure({ ANTHROPIC_API_KEY: "sk-super-secret", PORT: "abc" }).message).not.toContain("sk-super-secret");
  });
});
