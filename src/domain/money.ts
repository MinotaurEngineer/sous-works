const AMOUNT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Parses a decimal amount ("-87.18", "170.7", "100") into integer cents.
 * Works on the digits of the text and never multiplies a float: 1.15 * 100 is 114.99999999999999.
 * Returns undefined for anything that is not a plain decimal with at most 2 decimals (no rounding,
 * no separators, no exponent) and for results that are not a safe integer.
 */
export const parseDecimalToCents = (raw: string): number | undefined => {
  const match = AMOUNT.exec(raw);
  if (!match) return undefined;
  const [, sign, whole, fraction = ""] = match;
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > MAX_CENTS) return undefined;
  return cents === 0n ? 0 : Number(sign ? -cents : cents);
};
