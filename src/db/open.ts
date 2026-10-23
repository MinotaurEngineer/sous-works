import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

/** Opens (creating if needed) the database at `path` and applies the schema. */
export const openDatabase = (path: string): DatabaseSync => {
  const db = new DatabaseSync(path);
  db.exec(schema);
  return db;
};
