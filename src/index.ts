import Anthropic from "@anthropic-ai/sdk";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createAnthropicCategoriser, createAnthropicComplete } from "./categoriser/anthropic.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/open.js";
import { createSqliteRepository } from "./repository/sqlite.js";

const config = loadConfig();
const db = openDatabase(config.DATABASE_PATH);

const app = createApp({
  categoriser: createAnthropicCategoriser({
    complete: createAnthropicComplete({
      client: new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, timeout: 30_000 }),
      model: config.ANTHROPIC_MODEL,
    }),
  }),
  repository: createSqliteRepository(db),
});

serve({ fetch: app.fetch, port: config.PORT }, ({ port }) =>
  console.log(`listening on :${port}`),
);
