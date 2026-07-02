import { GitRunner } from "./GitRunner";
import { RS, US, relativeTime, shortStatus } from "./parse";
import type { Commit, FileChange } from "../shared/protocol";

interface NameStatusFile {
  status: string;
  path: string;
  oldPath?: string;
}

function parseNameStatusLine(line: string): NameStatusFile {
  const parts = line.split("\t");
  const st = parts[0];
  if (/^[RC]/.test(st)) {
    return { status: shortStatus(st), oldPath: parts[1], path: parts[2] ?? parts[1] };
  }
  return { status: shortStatus(st), path: parts[1] ?? "" };
}

function parseNumstatLine(line: string): { add: number; del: number; path: string } {
  const parts = line.split("\t");
  const add = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
  const del = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
  let p = parts.slice(2).join("\t");
  // rename forms: "old => new" or "dir/{old => new}/file"
  const m = /\{.* => (.*)\}/.exec(p);
  if (m) p = p.replace(/\{.* => (.*)\}/, "$1");
  else if (p.includes(" => ")) p = p.split(" => ")[1];
  return { add, del, path: p };
}

function splitRecords(stdout: string): string[] {
  return stdout
    .split(RS)
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.length > 0);
}

/**
 * Commits unique to `head` vs `base` (range base..head), newest-first,
 * each with per-file status + add/del. Mirrors the design's `commits` array.
 */
export async function commitsInRange(
  git: GitRunner,
  base: string,
  head = "HEAD"
): Promise<Commit[]> {
  const range = `${base}..${head}`;
  const ns = await git.tryRun([
    "log",
    "--no-merges",
    "--topo-order",
    `--pretty=tformat:${RS}%h${US}%H${US}%an${US}%aI${US}%s`,
    "--name-status",
    range,
  ]);
  const num = await git.tryRun([
    "log",
    "--no-merges",
    "--topo-order",
    `--pretty=tformat:${RS}%h`,
    "--numstat",
    range,
  ]);

  const numByHash: Record<string, Array<{ add: number; del: number; path: string }>> = {};
  for (const rec of splitRecords(num.stdout)) {
    const lines = rec.split("\n");
    const hash = lines[0].trim();
    numByHash[hash] = lines
      .slice(1)
      .filter((l) => l.trim())
      .map(parseNumstatLine);
  }

  const now = new Date();
  return splitRecords(ns.stdout).map((rec) => {
    const lines = rec.split("\n");
    const [hash, fullHash, author, iso, ...subjectParts] = lines[0].split(US);
    const subject = subjectParts.join(US);
    const fileLines = lines.slice(1).filter((l) => l.trim());
    const nums = numByHash[hash] || [];
    const files: FileChange[] = fileLines.map((l, idx) => {
      const f = parseNameStatusLine(l);
      const n = nums[idx] || { add: 0, del: 0 };
      return {
        path: f.path,
        oldPath: f.oldPath,
        status: f.status,
        add: n.add,
        del: n.del,
      };
    });
    return {
      hash,
      fullHash,
      message: subject,
      author,
      time: relativeTime(iso, now),
      isoTime: iso,
      files,
    };
  });
}
