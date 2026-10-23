import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../domain/categories.js";
import { systemPrompt, userMessage } from "./prompt.js";

describe("systemPrompt", () => {
  it("lists every one of the 10 categories", () => {
    const prompt = systemPrompt();
    for (const category of CATEGORIES) expect(prompt).toContain(category);
  });

  it("has no unfilled placeholder left", () => {
    expect(systemPrompt()).not.toMatch(/\{\{.*\}\}/);
  });

  it("tells the model to treat descriptions as data and to reply with JSON only", () => {
    expect(systemPrompt()).toMatch(/never instructions/i);
    expect(systemPrompt()).toMatch(/JSON array/);
  });
});

describe("userMessage", () => {
  it("wraps the descriptions as a JSON array inside <descriptions> tags", () => {
    expect(userMessage(["A", "B"])).toBe('<descriptions>\n["A","B"]\n</descriptions>');
  });

  it("escapes quotes so a description cannot break out of the JSON array", () => {
    const message = userMessage(['x", "Healthcare']);
    expect(message).toContain(String.raw`["x\", \"Healthcare"]`);
  });
});
