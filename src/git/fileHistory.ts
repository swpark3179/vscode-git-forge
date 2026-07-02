import { GitRunner } from "./GitRunner";
import { RS, US, relativeTime, shortStatus, parseUnifiedDiff } from "./parse";
import type { FileVersion } from "../shared/protocol";

/** All tracked files (the file-picker source). */
export async function listTrackedFiles(git: GitRunner): Promise<string[]> {
  const r = await git.tryRun(["ls-files", "-z"]);
  return r.stdout.split("\0").filter(Boolean);
}

/**
 * History of one file (newest-first), with status + add/del per version.
 * Uses --follow to track renames.
 */
export async function fileHistory(
  git: GitRunner,
  path: string,
  max = 100
): Promise<FileVersion[]> {
  const ns = await git.tryRun([
    "log",
    "--follow",
    `--pretty=tformat:${RS}%h${US}%H${US}%an${US}%aI${US}%s`,
    "--name-status",
    `--max-count=${max}`,
    "--",
    path,
  ]);
  const num = await git.tryRun([
    "log",
    "--follow",
    `--pretty=tformat:${RS}%h`,
    "--numstat",
    `--max-count=${max}`,
    "--",
    path,
  ]);

  const numByHash: Record<string, { add: number; del: number }> = {};
  for (const rec of num.stdout.split(RS).map((s) => s.replace(/^\n/, "")).filter(Boolean)) {
    const lines = rec.split("\n");
    const hash = lines[0].trim();
    const fileLine = lines.slice(1).find((l) => l.trim());
    if (fileLine) {
      const p = fileLine.split("\t");
      numByHash[hash] = {
        add: p[0] === "-" ? 0 : parseInt(p[0], 10) || 0,
        del: p[1] === "-" ? 0 : parseInt(p[1], 10) || 0,
      };
    }
  }

  const now = new Date();
  return ns.stdout
    .split(RS)
    .map((s) => s.replace(/^\n/, ""))
    .filter(Boolean)
    .map((rec) => {
      const lines = rec.split("\n");
      const [hash, fullHash, author, iso, ...subj] = lines[0].split(US);
      const fileLine = lines.slice(1).find((l) => l.trim()) ?? "";
      const status = shortStatus(fileLine.split("\t")[0] || "M");
      const n = numByHash[hash] || { add: 0, del: 0 };
      return {
        hash,
        fullHash,
        msg: subj.join(US),
        author,
        time: relativeTime(iso, now),
        status,
        add: n.add,
        del: n.del,
        hunkOld: 0,
        hunkNew: 0,
        diff: [],
      } as FileVersion;
    });
}

/** Diff of one file at one commit vs its parent (lazy, on selection). */
export async function fileVersionDiff(
  git: GitRunner,
  hash: string,
  path: string
): Promise<{ hunkOld: number; hunkNew: number; diff: FileVersion["diff"] }> {
  const r = await git.tryRun(["show", hash, "-U3", "--", path]);
  const parsed = parseUnifiedDiff(r.stdout);
  return { hunkOld: parsed.hunkOld, hunkNew: parsed.hunkNew, diff: parsed.diff };
}

/** Full file contents at a commit (for read-only "open this version"). */
export async function fileAtCommit(
  git: GitRunner,
  hash: string,
  path: string
): Promise<string> {
  const r = await git.tryRun(["show", `${hash}:${path}`]);
  return r.stdout;
}
