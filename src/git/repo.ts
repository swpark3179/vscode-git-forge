import { GitRunner } from "./GitRunner";

/** Resolve the git repository root for a folder; returns a rooted GitRunner or null. */
export async function discoverRepo(folder: string): Promise<GitRunner | null> {
  const probe = new GitRunner(folder);
  const r = await probe.tryRun(["rev-parse", "--show-toplevel"]);
  if (r.code !== 0) return null;
  const root = r.stdout.trim();
  if (!root) return null;
  return new GitRunner(root);
}

export async function repoRoot(git: GitRunner): Promise<string> {
  return (await git.text(["rev-parse", "--show-toplevel"])).trim();
}

export async function currentBranch(git: GitRunner): Promise<string> {
  const r = await git.tryRun(["symbolic-ref", "--short", "-q", "HEAD"]);
  const name = r.stdout.trim();
  if (name) return name;
  // Detached HEAD: use short hash.
  const h = await git.tryRun(["rev-parse", "--short", "HEAD"]);
  return h.stdout.trim() || "HEAD";
}

export async function isDetached(git: GitRunner): Promise<boolean> {
  const r = await git.tryRun(["symbolic-ref", "--quiet", "HEAD"]);
  return r.code !== 0;
}

export async function listBranches(git: GitRunner): Promise<string[]> {
  const r = await git.tryRun([
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  ]);
  return r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function refExists(git: GitRunner, ref: string): Promise<boolean> {
  const r = await git.tryRun(["rev-parse", "--verify", "--quiet", ref]);
  return r.code === 0 && !!r.stdout.trim();
}

/** Detect the repo's default branch (never hardcode master). */
export async function detectDefaultBranch(git: GitRunner): Promise<string> {
  // 1) origin/HEAD symref
  const sym = await git.tryRun([
    "symbolic-ref",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  let name = sym.stdout.trim();
  if (name.startsWith("origin/")) name = name.slice("origin/".length);
  if (name) return name;

  // 2) Try to (re)establish origin/HEAD, then re-read.
  await git.tryRun(["remote", "set-head", "origin", "-a"]);
  const sym2 = await git.tryRun([
    "symbolic-ref",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  let name2 = sym2.stdout.trim();
  if (name2.startsWith("origin/")) name2 = name2.slice("origin/".length);
  if (name2) return name2;

  // 3) init.defaultBranch config
  const cfg = await git.tryRun(["config", "--get", "init.defaultBranch"]);
  const cfgName = cfg.stdout.trim();
  if (cfgName && (await refExists(git, cfgName))) return cfgName;

  // 4) common names, local or remote
  for (const cand of ["main", "master", "develop"]) {
    if (
      (await refExists(git, cand)) ||
      (await refExists(git, `origin/${cand}`))
    ) {
      return cand;
    }
  }
  // 5) fall back to current branch
  return currentBranch(git);
}

/** [behind, ahead] of HEAD relative to base. */
export async function aheadBehind(
  git: GitRunner,
  base: string,
  head = "HEAD"
): Promise<{ ahead: number; behind: number }> {
  if (!(await refExists(git, base))) return { ahead: 0, behind: 0 };
  const r = await git.tryRun([
    "rev-list",
    "--left-right",
    "--count",
    `${base}...${head}`,
  ]);
  const [behind, ahead] = r.stdout.trim().split(/\s+/).map((n) => parseInt(n, 10) || 0);
  return { ahead: ahead || 0, behind: behind || 0 };
}

/** Count of uncommitted changes in the working tree + index. */
export async function dirtyCount(git: GitRunner): Promise<number> {
  const r = await git.tryRun(["status", "--porcelain=v2", "-z"]);
  if (!r.stdout) return 0;
  // Entries are NUL-separated; skip the branch header lines (start with "# ").
  return r.stdout
    .split("\0")
    .filter((e) => e && !e.startsWith("# ")).length;
}

/** How many commits origin/<def> is ahead of local <def>. */
export async function masterBehind(git: GitRunner, def: string): Promise<number> {
  const remote = `origin/${def}`;
  if (!(await refExists(git, remote)) || !(await refExists(git, def))) return 0;
  const r = await git.tryRun(["rev-list", "--count", `${def}..${remote}`]);
  return parseInt(r.stdout.trim(), 10) || 0;
}
