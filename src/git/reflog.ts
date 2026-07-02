import { GitRunner } from "./GitRunner";
import { US } from "./parse";
import { listBackups } from "./safety";
import type { ReflogEntry } from "../shared/protocol";

/** Read the HEAD reflog (newest-first), merging in git-forge backup refs. */
export async function readReflog(git: GitRunner, max = 100): Promise<ReflogEntry[]> {
  const r = await git.tryRun([
    "reflog",
    `--format=%gd${US}%gs${US}%h${US}%H${US}%s${US}%cr`,
    `-n`,
    String(max),
  ]);
  const entries: ReflogEntry[] = r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [ref, gs, hash, fullHash, subject, when] = line.split(US);
      const action = (gs || "").split(":")[0].trim() || "move";
      return {
        ref,
        selector: ref,
        action,
        hash,
        fullHash,
        desc: subject || gs || "",
        when,
        isBackup: false,
        // augmented below
      } as ReflogEntry & { isCurrent?: boolean };
    });
  if (entries.length) (entries[0] as any).isCurrent = true;

  // Append git-forge backup refs as explicit restore points.
  const backups = await listBackups(git);
  for (const b of backups) {
    entries.push({
      ref: b.ref.replace("refs/git-forge/backup/", "backup/"),
      selector: b.ref,
      action: "git-forge-backup",
      hash: b.hash,
      fullHash: b.hash,
      desc: b.subject,
      when: "",
      isBackup: true,
    });
  }
  return entries;
}
