import { GitRunner } from "./GitRunner";
import { US } from "./parse";
import { currentBranch } from "./repo";
import type { BranchInfo } from "../shared/protocol";

function globMatch(name: string, pattern: string): boolean {
  if (!pattern.includes("*")) return name === pattern;
  const re = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  return re.test(name);
}

export interface ClassifyOpts {
  def: string;
  protectedGlobs: string[];
  staleDays: number;
}

export async function classifyBranches(
  git: GitRunner,
  opts: ClassifyOpts
): Promise<BranchInfo[]> {
  const cur = await currentBranch(git);
  const r = await git.tryRun([
    "for-each-ref",
    "--sort=-committerdate",
    `--format=%(refname:short)${US}%(committerdate:iso8601)${US}%(committerdate:relative)${US}%(upstream:short)${US}%(upstream:track)${US}%(objectname:short)${US}%(subject)`,
    "refs/heads",
  ]);
  const mergedR = await git.tryRun(["branch", "--merged", opts.def, "--format=%(refname:short)"]);
  const merged = new Set(
    mergedR.stdout.split("\n").map((s) => s.trim()).filter(Boolean)
  );

  const now = Date.now();
  const staleMs = opts.staleDays * 24 * 60 * 60 * 1000;

  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, iso, rel, upstream, track, tip, subject] = line.split(US);
      const isProtected =
        name === opts.def || opts.protectedGlobs.some((g) => globMatch(name, g));
      const gone = (track || "").includes("gone");
      const old = now - Date.parse(iso) > staleMs;
      let kind: BranchInfo["kind"];
      if (name === cur) kind = "current";
      else if (isProtected) kind = "protected";
      else if (merged.has(name)) kind = "merged";
      else if (gone || old) kind = "stale";
      else kind = "active";
      return {
        name,
        kind,
        upstream: upstream || undefined,
        track: track || undefined,
        ageRelative: rel,
        isoDate: iso,
        subject: subject ?? "",
        tip,
      };
    });
}
