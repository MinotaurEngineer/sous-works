import { isCategory, type Category } from "../domain/categories.js";
import type { Categoriser } from "./categoriser.js";
import { normaliseCategories } from "./normalise.js";
import { systemPrompt, userMessage } from "./prompt.js";

/** Sends one system prompt and one user message to the model; returns its text reply. */
export type Complete = (system: string, user: string) => Promise<string>;

const DEFAULT_BATCH_SIZE = 50;
const MAX_ATTEMPTS = 2;
const MAX_TOKENS = 1024;

/** Finds the JSON array in a reply, tolerating code fences and surrounding prose. */
const parseLabels = (reply: string): unknown[] => {
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start === -1 || end < start) throw new Error("Reply contains no JSON array");
  const parsed: unknown = JSON.parse(reply.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("Reply is not a JSON array");
  return parsed;
};

/**
 * Categorises by distinct description only (amount and type are unreliable in the data),
 * remembering every answer, so each description costs at most one model call per process.
 */
export const createAnthropicCategoriser = ({
  complete,
  batchSize = DEFAULT_BATCH_SIZE,
  warn = console.warn,
}: {
  complete: Complete;
  batchSize?: number;
  warn?: (message: string) => void;
}): Categoriser => {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`batchSize must be a positive integer, got ${batchSize}`);
  }
  const cache = new Map<string, Category>();

  const categoriseChunk = async (descriptions: string[]): Promise<Category[]> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // A failed call is not retried here: the SDK already retries transport errors.
      const reply = await complete(systemPrompt(), userMessage(descriptions));
      try {
        const labels = parseLabels(reply);
        const categories = normaliseCategories(labels, descriptions.length);
        labels.forEach((label, i) => {
          if (!isCategory(label)) {
            warn(
              `Replaced invalid category ${JSON.stringify(label)} for description ${JSON.stringify(descriptions[i])} with ${categories[i]}`,
            );
          }
        });
        return categories;
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(`Model output unusable after ${MAX_ATTEMPTS} attempts`, { cause: lastError });
  };

  return {
    async categorise(inputs) {
      const unseen = [...new Set(inputs.map((t) => t.description))].filter((d) => !cache.has(d));
      for (let i = 0; i < unseen.length; i += batchSize) {
        const chunk = unseen.slice(i, i + batchSize);
        const categories = await categoriseChunk(chunk);
        chunk.forEach((description, j) => cache.set(description, categories[j]!));
      }
      return inputs.map((t) => cache.get(t.description)!);
    },
  };
};

type MessagesClient = {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: "user"; content: string }>;
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
};

export const createAnthropicComplete =
  ({ client, model }: { client: MessagesClient; model: string }): Complete =>
  async (system, user) => {
    const reply = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = reply.content.flatMap((b) => (b.type === "text" && b.text !== undefined ? [b.text] : [])).join("");
    if (!text) throw new Error("Model reply contained no text");
    return text;
  };
