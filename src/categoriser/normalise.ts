import { FALLBACK_CATEGORY, isCategory, type Category } from "../domain/categories.js";

/**
 * Turns raw model labels into Categories.
 * A label that is not one of the 10 categories becomes FALLBACK_CATEGORY.
 * A wrong number of labels throws: labels could no longer be matched to transactions.
 */
export const normaliseCategories = (labels: unknown[], expected: number): Category[] => {
  if (labels.length !== expected) {
    throw new Error(`Expected ${expected} labels, got ${labels.length}`);
  }
  return labels.map((label) => (isCategory(label) ? label : FALLBACK_CATEGORY));
};
