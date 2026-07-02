import { RS, US } from "./GitRunner";
import type { DiffLine } from "../shared/protocol";

export { RS, US };

/** Split git output into records (on RS), dropping empty leading/trailing. */
export function records(stdout: string): string[] {
  return stdout
    .split(RS)
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.length > 0);
}

/** Split a record into fields (on US). */
export function fields(rec: string): string[] {
  return rec.split(US);
}

/** Korean relative time from an ISO timestamp. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  let s = Math.floor((now.getTime() - t) / 1000);
  if (s < 0) s = 0;
  if (s < 45) return "방금 전";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}개월 전`;
  const y = Math.floor(d / 365);
  return `${y}년 전`;
}

export interface ParsedDiff {
  hunkOld: number;
  hunkNew: number;
  diff: DiffLine[];
}

/**
 * Parse a unified diff body (e.g. from `git show -U3 -- <path>`), capturing
 * the first hunk's @@ header offsets and all +/-/context lines.
 * Header lines (diff --git, index, ---, +++, etc.) are skipped.
 */
export function parseUnifiedDiff(patch: string, maxLines = 400): ParsedDiff {
  const out: DiffLine[] = [];
  let hunkOld = 0;
  let hunkNew = 0;
  let seenHunk = false;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      if (!seenHunk) {
        const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (m) {
          hunkOld = parseInt(m[1], 10);
          hunkNew = parseInt(m[2], 10);
        }
        seenHunk = true;
      }
      continue;
    }
    if (!seenHunk) continue;
    if (
      raw.startsWith("diff ") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ") ||
      raw.startsWith("new file") ||
      raw.startsWith("deleted file") ||
      raw.startsWith("similarity ") ||
      raw.startsWith("rename ") ||
      raw.startsWith("\\ No newline")
    ) {
      continue;
    }
    const sign = raw.charAt(0);
    if (sign === "+" || sign === "-" || sign === " ") {
      out.push({ sign: sign as " " | "+" | "-", line: raw.slice(1) });
      if (out.length >= maxLines) break;
    }
  }
  return { hunkOld, hunkNew, diff: out };
}

/** Map a git status letter to its first character (handles R100/C75 forms). */
export function shortStatus(s: string): string {
  return (s || "").charAt(0).toUpperCase();
}
