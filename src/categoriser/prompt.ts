import { readFileSync } from "node:fs";
import { CATEGORIES } from "../domain/categories.js";

const PLACEHOLDER = "{{categories}}";

// prompts/categorise.md is the single source of the runtime prompt. Read at startup: crash early if missing.
const template = readFileSync(new URL("../../prompts/categorise.md", import.meta.url), "utf8");
if (!template.includes(PLACEHOLDER)) {
  throw new Error(`prompts/categorise.md must contain ${PLACEHOLDER}`);
}

const prompt = template.replace(PLACEHOLDER, CATEGORIES.map((c) => `- ${c}`).join("\n"));

export const systemPrompt = (): string => prompt;

/** Descriptions are untrusted input: JSON-encoded, so they cannot break out of the array. */
export const userMessage = (descriptions: string[]): string =>
  `<descriptions>\n${JSON.stringify(descriptions)}\n</descriptions>`;
