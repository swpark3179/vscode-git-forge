import { GitRunner } from "./GitRunner";
import { RS, US } from "./parse";
import type { SearchResult, SearchHunk } from "../shared/protocol";

export type SearchMode = "message" | "author" | "file" | "code";

const META_FMT = `--pretty=tformat:${RS}%h${US}%an${US}%cr${US}%s`;

function range(text: string, q: string): [number, number] | undefined {
  if (!q) return undefined;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  return i === -1 ? undefined : [i, i + q.length];
}

export async function searchHistory(
  git: GitRunner,
  mode: SearchMode,
  query: string,
  max = 200
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (mode === "message" || mode === "author") {
    const flag = mode === "message" ? `--grep=${q}` : `--author=${q}`;
    const r = await git.tryRun([
      "log",
      "--all",
      "-i",
      flag,
      META_FMT,
      `--max-count=${max}`,
    ]);
    return r.stdout
      .split(RS)
      .map((s) => s.replace(/^\n/, ""))
      .filter(Boolean)
      .map((rec) => {
        const [hash, author, time, ...subj] = rec.split("\n")[0].split(US);
        const message = subj.join(US);
        return {
          hash,
          author,
          time,
          message,
          msgMatch: mode === "message" ? range(message, q) : undefined,
          authorMatch: mode === "author" ? range(author, q) : undefined,
        };
      });
  }

  if (mode === "file") {
    // Mirror the design: commits touching a file whose path contains q.
    const r = await git.tryRun([
      "log",
      "--all",
      META_FMT,
      "--name-only",
      `--max-count=${max * 3}`,
    ]);
    const out: SearchResult[] = [];
    for (const rec of r.stdout.split(RS).map((s) => s.replace(/^\n/, "")).filter(Boolean)) {
      const lines = rec.split("\n");
      const [hash, author, time, ...subj] = lines[0].split(US);
      const fileHit = lines
        .slice(1)
        .map((l) => l.trim())
        .filter(Boolean)
        .find((p) => p.toLowerCase().includes(q.toLowerCase()));
      if (fileHit) {
        out.push({
          hash,
          author,
          time,
          message: subj.join(US),
          fileHit,
          fileMatch: range(fileHit, q),
        });
        if (out.length >= max) break;
      }
    }
    return out;
  }

  // code (pickaxe): commits that changed the number of occurrences of q.
  const r = await git.tryRun([
    "log",
    "--all",
    `-S${q}`,
    META_FMT,
    "-p",
    "-U1",
    `--max-count=${Math.min(max, 60)}`,
  ]);
  const results: SearchResult[] = [];
  for (const rec of r.stdout.split(RS).map((s) => s.replace(/^\n/, "")).filter(Boolean)) {
    const lines = rec.split("\n");
    const [hash, author, time, ...subj] = lines[0].split(US);
    const hunks: SearchHunk[] = [];
    let curFile = "";
    for (const l of lines.slice(1)) {
      if (l.startsWith("diff --git")) {
        const m = / b\/(.*)$/.exec(l);
        curFile = m ? m[1] : curFile;
        continue;
      }
      if (l.startsWith("+++") || l.startsWith("---") || l.startsWith("@@") || l.startsWith("index ")) continue;
      if ((l.startsWith("+") || l.startsWith("-")) && l.toLowerCase().includes(q.toLowerCase())) {
        const text = l.slice(1);
        hunks.push({
          file: curFile,
          sign: l[0] as "+" | "-",
          line: text,
          ...(range(text, q) ? { matchStart: range(text, q)![0], matchEnd: range(text, q)![1] } : {}),
        });
        if (hunks.length >= 6) break;
      }
    }
    results.push({ hash, author, time, message: subj.join(US), hunks });
  }
  return results;
}
