// Message contract shared by the extension host and the webview bundle.
// Two channels: request/response (correlated by `id`) and fire-and-forget events.

export type ViewName =
  | "welcome"
  | "reforge"
  | "restruct"
  | "sync"
  | "cleanup"
  | "reflog"
  | "graph"
  | "search"
  | "filehist";

// ---- Domain data shapes (the real-git replacements for the design's seed arrays) ----

export interface FileChange {
  path: string;
  status: string; // A | M | D | R | C ...
  add: number;
  del: number;
  oldPath?: string; // for renames
}

export interface Commit {
  hash: string; // short
  fullHash: string;
  message: string;
  author: string;
  time: string; // relative, e.g. "2시간 전"
  isoTime: string;
  files: FileChange[];
}

export interface BranchInfo {
  name: string;
  kind: "current" | "protected" | "merged" | "stale" | "active";
  upstream?: string;
  track?: string; // e.g. "[gone]", "[ahead 1]"
  ageRelative: string;
  isoDate: string;
  subject: string;
  tip: string; // short sha
}

export interface ReflogEntry {
  ref: string; // HEAD@{n}
  selector: string; // full %gD
  action: string; // commit | reset | rebase | checkout | git-forge-backup ...
  hash: string; // short
  fullHash: string;
  desc: string;
  when: string;
  isBackup?: boolean;
}

export interface GraphRef {
  t: "head" | "branch" | "remote" | "tag";
  name: string;
}

export interface GraphCommit {
  id: string; // full hash
  hash: string; // short
  msg: string;
  author: string;
  time: string;
  parents: string[]; // full hashes
  merge: boolean;
  refs: GraphRef[];
  lane: number;
}

export interface GraphEdge {
  fromLane: number;
  toLane: number;
  fromRow: number;
  toRow: number;
  color: number; // lane index for color
}

export interface SearchHunk {
  file: string;
  sign: "+" | "-";
  line: string;
  matchStart?: number;
  matchEnd?: number;
}

export interface SearchResult {
  hash: string;
  message: string;
  author: string;
  time: string;
  fileHit?: string;
  hunks?: SearchHunk[];
  // match positions for highlight in message/author/file
  msgMatch?: [number, number];
  authorMatch?: [number, number];
  fileMatch?: [number, number];
}

export interface DiffLine {
  sign: " " | "+" | "-";
  line: string;
}

export interface FileVersion {
  hash: string;
  fullHash: string;
  msg: string;
  author: string;
  time: string;
  status: string;
  add: number;
  del: number;
  hunkOld: number;
  hunkNew: number;
  diff: DiffLine[];
}

export interface RepoSnapshot {
  repoRoot: string;
  repoName: string;
  hasRepo: boolean;
  currentBranch: string;
  baseBranch: string; // detected default branch
  branches: string[];
  ahead: number;
  behind: number;
  dirtyCount: number;
  masterBehind: number; // commits origin/default is ahead of local default
  error?: string;
}

// ---- Streaming op primitives ----

export type StageStatus = "pending" | "running" | "done" | "error" | "conflict";

export interface StageUpdate {
  id: string;
  label?: string;
  status?: StageStatus;
  current?: number;
  total?: number;
  detail?: string;
}

export type LogKind = "cmd" | "out" | "pick" | "ok" | "err";

export interface LogLine {
  kind: LogKind;
  text: string;
  skip?: string;
}

// ---- Webview -> Host ----

export type ToHost =
  | { type: "ready" }
  | { type: "open"; view: ViewName }
  | { type: "navigate"; view: ViewName }
  | { id: number; type: "query"; name: QueryName; args?: any }
  | { id: number; type: "operation"; name: OpName; args?: any }
  | { id: number; type: "cancel" };

export type QueryName =
  | "snapshot"
  | "reforgeSetup"
  | "restructCommits"
  | "syncPreview"
  | "branches"
  | "reflog"
  | "graph"
  | "graphCommitFiles"
  | "search"
  | "fileList"
  | "fileHistory"
  | "fileDiff";

export type OpName =
  | "reforge"
  | "restructure"
  | "sync"
  | "cleanup"
  | "restoreReflog"
  | "openVersion"
  | "undo";

// ---- Host -> Webview ----

export type ToWebview =
  | { type: "snapshot"; data: RepoSnapshot }
  | { type: "navigate"; view: ViewName }
  | { id: number; type: "result"; ok: boolean; data?: any; error?: string }
  | { id: number; type: "stage"; stage: StageUpdate }
  | { id: number; type: "log"; line: LogLine }
  | { id: number; type: "done"; summary?: any }
  | { id: number; type: "error"; message: string };
