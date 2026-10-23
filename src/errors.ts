const MAX_LENGTH = 500;
const MAX_CAUSES = 5;

const describe = (value: unknown): string => {
  if (!(value instanceof Error)) {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }
  // SDK errors carry status and requestID next to bulky headers; keep the first two only.
  const { status, requestID } = value as { status?: unknown; requestID?: unknown };
  const details = [
    typeof status === "number" ? `status ${status}` : undefined,
    typeof requestID === "string" ? `request ${requestID}` : undefined,
  ].filter(Boolean);
  return `${value.name}: ${value.message}${details.length ? ` (${details.join(", ")})` : ""}`;
};

/** One log line for an error and its causes: no stack, no headers, bounded length. */
export const summariseError = (error: unknown): string => {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  for (let current = error; parts.length < MAX_CAUSES && !seen.has(current); ) {
    seen.add(current);
    parts.push(describe(current));
    if (!(current instanceof Error) || current.cause === undefined) break;
    current = current.cause;
  }
  const line = parts.join(" | caused by: ").replace(/\s+/g, " ").trim();
  return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH)}…` : line;
};
