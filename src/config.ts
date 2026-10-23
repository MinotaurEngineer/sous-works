import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/app.db"),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-5-5"),
});
export type Config = z.infer<typeof Env>;

/** Crash early: throws with every invalid variable named. */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config =>
  Env.parse(env);
