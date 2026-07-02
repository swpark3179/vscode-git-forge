import * as fs from "fs";
import { GitRunner } from "./GitRunner";

export interface BackupInfo {
  ref: string;
  head: string; // full sha that was HEAD
  feature: string;
  stashRef?: string;
}

function stamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Create a private backup ref at current HEAD before a history rewrite. */
export async function createBackup(
  git: GitRunner,
  feature: string
): Promise<BackupInfo> {
  const head = (await git.text(["rev-parse", "HEAD"])).trim();
  const ref = `refs/git-forge/backup/${stamp()}-${feature}`;
  await git.run([
    "update-ref",
    "-m",
    `git-forge backup before ${feature}`,
    ref,
    head,
  ]);
  return { ref, head, feature };
}

export interface BackupRef {
  ref: string;
  hash: string;
  subject: string;
}

export async function listBackups(git: GitRunner): Promise<BackupRef[]> {
  const r = await git.tryRun([
    "for-each-ref",
    "--sort=-creatordate",
    "--format=%(refname)\x1f%(objectname:short)\x1f%(subject)",
    "refs/git-forge/backup",
  ]);
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [ref, hash, subject] = line.split("\x1f");
      return { ref, hash, subject: subject ?? "" };
    });
}

/** Restore HEAD/working tree to a ref or sha (hard reset). */
export async function restoreTo(git: GitRunner, target: string): Promise<void> {
  await git.run(["reset", "--hard", target]);
}

export async function isClean(git: GitRunner): Promise<boolean> {
  const r = await git.tryRun(["status", "--porcelain=v2", "-z"]);
  const entries = r.stdout.split("\0").filter((e) => e && !e.startsWith("# "));
  return entries.length === 0;
}

/** Detect an in-progress rebase/merge/cherry-pick so we never start atop one. */
export async function operationInProgress(
  git: GitRunner
): Promise<string | null> {
  const checks: Array<[string, string]> = [
    ["rebase-merge", "rebase"],
    ["rebase-apply", "rebase"],
    ["MERGE_HEAD", "merge"],
    ["CHERRY_PICK_HEAD", "cherry-pick"],
    ["REVERT_HEAD", "revert"],
    ["BISECT_LOG", "bisect"],
  ];
  for (const [pathName, label] of checks) {
    const r = await git.tryRun(["rev-parse", "--git-path", pathName]);
    const p = r.stdout.trim();
    if (p && fs.existsSync(p)) return label;
  }
  return null;
}

export interface Preconditions {
  ok: boolean;
  reason?: string;
}

/** Gate for any mutating feature. */
export async function ensureCanMutate(
  git: GitRunner,
  opts: { requireClean?: boolean } = {}
): Promise<Preconditions> {
  const inProgress = await operationInProgress(git);
  if (inProgress) {
    return {
      ok: false,
      reason: `진행 중인 ${inProgress} 작업이 있습니다. 먼저 완료하거나 중단하세요.`,
    };
  }
  if (opts.requireClean && !(await isClean(git))) {
    return {
      ok: false,
      reason: "작업 트리에 커밋되지 않은 변경이 있습니다.",
    };
  }
  return { ok: true };
}
