export const CATEGORIES = [
  "Groceries",
  "Dining Out",
  "Utilities",
  "Transportation",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Housing",
  "Education",
  "Miscellaneous",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const FALLBACK_CATEGORY: Category = "Miscellaneous";

export const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
