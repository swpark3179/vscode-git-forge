import { esc } from "./dom";

/** Diff/file status → color (design statusColor, line 1335). */
export function statusColor(s: string): string {
  return s === "A"
    ? "#81b88b"
    : s === "D"
    ? "#c74e39"
    : s === "R"
    ? "#75beff"
    : "#e2c08d";
}

/** Render text with an optional [start,end) match highlighted. */
export function highlight(text: string, range?: [number, number]): string {
  if (!range) return esc(text);
  const [a, b] = range;
  return (
    esc(text.slice(0, a)) +
    `<span style="background:#5a4a12;color:#ffe28f;font-weight:700;border-radius:2px;">${esc(
      text.slice(a, b)
    )}</span>` +
    esc(text.slice(b))
  );
}
