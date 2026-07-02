import { GitRunner } from "./GitRunner";
import { US } from "./parse";
import type { GraphCommit, GraphRef, FileChange } from "../shared/protocol";
import { shortStatus } from "./parse";

function parseRefs(decoration: string, remotePrefixes: string[]): GraphRef[] {
  if (!decoration) return [];
  const refs: GraphRef[] = [];
  for (const tokRaw of decoration.split(",")) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    if (tok.startsWith("HEAD -> ")) {
      refs.push({ t: "head", name: tok.slice("HEAD -> ".length) });
    } else if (tok === "HEAD") {
      refs.push({ t: "head", name: "HEAD" });
    } else if (tok.startsWith("tag: ")) {
      refs.push({ t: "tag", name: tok.slice("tag: ".length) });
    } else if (remotePrefixes.some((p) => tok.startsWith(p))) {
      refs.push({ t: "remote", name: tok });
    } else {
      refs.push({ t: "branch", name: tok });
    }
  }
  return refs;
}

function allocate(lanes: (string | null)[]): number {
  const idx = lanes.indexOf(null);
  if (idx !== -1) return idx;
  lanes.push(null);
  return lanes.length - 1;
}

/** Resolve the lane for a commit, collapsing any duplicate reservations. */
function placeLane(lanes: (string | null)[], id: string): number {
  let idx = lanes.indexOf(id);
  if (idx === -1) idx = allocate(lanes);
  for (let i = 0; i < lanes.length; i++) {
    if (i !== idx && lanes[i] === id) lanes[i] = null;
  }
  return idx;
}

export async function buildGraph(
  git: GitRunner,
  opts: { all?: boolean; max?: number } = {}
): Promise<{ nodes: GraphCommit[]; laneCount: number }> {
  const remotesR = await git.tryRun(["remote"]);
  const remotePrefixes = remotesR.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((r) => r + "/");

  const args = [
    "log",
    opts.all === false ? "HEAD" : "--all",
    "--topo-order",
    "--date-order",
    `--pretty=tformat:%H${US}%h${US}%P${US}%an${US}%cr${US}%s${US}%D`,
    `--max-count=${opts.max ?? 300}`,
  ];
  const r = await git.tryRun(args);
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);

  const nodes: GraphCommit[] = lines.map((line) => {
    const [id, hash, parentsStr, author, time, subject, decoration] = line.split(US);
    const parents = parentsStr ? parentsStr.split(" ").filter(Boolean) : [];
    return {
      id,
      hash,
      msg: subject ?? "",
      author,
      time,
      parents,
      merge: parents.length > 1,
      refs: parseRefs(decoration ?? "", remotePrefixes),
      lane: 0,
    };
  });

  // Lane assignment: single pass, children before parents (topo order).
  const lanes: (string | null)[] = [];
  let laneCount = 0;
  for (const c of nodes) {
    const lane = placeLane(lanes, c.id);
    c.lane = lane;
    lanes[lane] = null; // consumed
    c.parents.forEach((p, k) => {
      if (k === 0) {
        if (lanes[lane] === null) lanes[lane] = p;
        else lanes[allocate(lanes)] = p;
      } else {
        lanes[allocate(lanes)] = p;
      }
    });
    laneCount = Math.max(laneCount, lanes.length);
  }
  return { nodes, laneCount };
}

/** Files changed by one commit (lazy, on selection). */
export async function commitFiles(
  git: GitRunner,
  hash: string
): Promise<{ files: FileChange[] }> {
  const ns = await git.tryRun(["show", "--pretty=tformat:", "--name-status", hash]);
  const num = await git.tryRun(["show", "--pretty=tformat:", "--numstat", hash]);
  const nsLines = ns.stdout.split("\n").filter((l) => l.trim());
  const numLines = num.stdout.split("\n").filter((l) => l.trim());
  const files: FileChange[] = nsLines.map((l, idx) => {
    const parts = l.split("\t");
    const st = parts[0];
    const rename = /^[RC]/.test(st);
    const path = rename ? parts[2] ?? parts[1] : parts[1] ?? "";
    const np = (numLines[idx] || "").split("\t");
    const add = np[0] === "-" ? 0 : parseInt(np[0], 10) || 0;
    const del = np[1] === "-" ? 0 : parseInt(np[1], 10) || 0;
    return {
      path,
      oldPath: rename ? parts[1] : undefined,
      status: shortStatus(st),
      add,
      del,
    };
  });
  return { files };
}
