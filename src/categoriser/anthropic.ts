import type { Categoriser } from "./categoriser.js";

/** Sends one system prompt and one user message to the model; returns its text reply. */
export type Complete = (system: string, user: string) => Promise<string>;

// TODO: implement.
export const createAnthropicCategoriser = (_opts: {
  complete: Complete;
  batchSize?: number;
  warn?: (message: string) => void;
}): Categoriser => ({
  async categorise() {
    throw new Error("AnthropicCategoriser not implemented");
  },
});

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

// TODO: implement.
export const createAnthropicComplete = (_opts: { client: MessagesClient; model: string }): Complete => {
  throw new Error("createAnthropicComplete not implemented");
};
