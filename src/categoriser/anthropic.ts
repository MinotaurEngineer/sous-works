import type { Categoriser } from "./categoriser.js";

// TODO: batch transactions, send prompts/categorise.md, validate output with isCategory,
// fall back to FALLBACK_CATEGORY (and log) on invalid output.
export const createAnthropicCategoriser = (_opts: {
  apiKey: string;
  model: string;
}): Categoriser => ({
  async categorise() {
    throw new Error("AnthropicCategoriser not implemented");
  },
});
