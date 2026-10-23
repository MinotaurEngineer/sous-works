import { describe, expect, it } from "vitest";
import { parseTimestamp } from "./timestamp.js";

const iso = (raw: string) => parseTimestamp(raw)?.toISOString();

describe("parseTimestamp: accepted", () => {
  it.each([
    ["Z suffix", "2024-05-16T07:22:18Z", "2024-05-16T07:22:18.000Z"],
    ["no offset is UTC, never host-local time", "2024-05-16T07:22:18", "2024-05-16T07:22:18.000Z"],
    ["space instead of T (CSV style)", "2024-05-16 07:22:18", "2024-05-16T07:22:18.000Z"],
    ["microseconds truncated to milliseconds", "2024-05-16 07:22:18.808433", "2024-05-16T07:22:18.808Z"],
    ["short fraction padded", "2024-05-16T07:22:18.5Z", "2024-05-16T07:22:18.500Z"],
    ["positive offset converted to UTC", "2024-05-16T09:22:18+02:00", "2024-05-16T07:22:18.000Z"],
    ["negative half-hour offset converted to UTC", "2024-05-16T07:22:18-05:30", "2024-05-16T12:52:18.000Z"],
    ["leap day", "2024-02-29T00:00:00Z", "2024-02-29T00:00:00.000Z"],
    ["offset can cross midnight", "2024-01-01T00:30:00+01:00", "2023-12-31T23:30:00.000Z"],
  ])("%s", (_name, raw, expected) => {
    expect(iso(raw)).toBe(expected);
  });
});

describe("parseTimestamp: rejected", () => {
  it.each([
    ["empty", ""],
    ["words", "not a date"],
    ["date only", "2024-05-16"],
    ["no seconds", "2024-05-16T07:22"],
    ["locale text", "May 16 2024 07:22:18"],
    ["leading space", " 2024-05-16T07:22:18Z"],
    ["trailing space", "2024-05-16T07:22:18Z "],
    ["space before Z", "2024-05-16T07:22:18 Z"],
    ["impossible day (Feb 30)", "2024-02-30T00:00:00Z"],
    ["Feb 29 in a non-leap year", "2023-02-29T00:00:00Z"],
    ["month 13", "2024-13-01T00:00:00Z"],
    ["hour 25", "2024-05-16T25:00:00Z"],
    ["minute 60", "2024-05-16T07:60:00Z"],
    ["offset without colon", "2024-05-16T07:22:18+0200"],
    ["impossible offset", "2024-05-16T07:22:18+25:00"],
  ])("%s", (_name, raw) => {
    expect(parseTimestamp(raw)).toBeUndefined();
  });
});
