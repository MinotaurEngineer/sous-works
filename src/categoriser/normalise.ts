import type { Category } from "../domain/categories.js";

// TODO: implement. Contract: one Category per label; unknown labels become FALLBACK_CATEGORY;
// throws if the label count differs from the expected count.
export const normaliseCategories = (_labels: unknown[], _expected: number): Category[] => {
  throw new Error("normaliseCategories not implemented");
};
