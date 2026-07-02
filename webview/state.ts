import type { RepoSnapshot, ViewName } from "../src/shared/protocol";

export type Phase = "setup" | "running" | "done" | "error" | "conflict";

export interface State {
  mode: "panel" | "sidebar";
  activeTab: ViewName;
  // The panel shows Welcome plus at most one feature tab (matches the design).
  featureTab: ViewName | null;

  snapshot: RepoSnapshot | null;

  // ---- reforge ----
  baseBranch: string;
  baseDropdownOpen: boolean;
  excluded: Record<string, boolean>;
  expanded: Record<string, boolean>;
  reforgePhase: Phase;

  // ---- restructure ----
  restructMode: "squash" | "split";
  restructPhase: Phase;
  restructSel: Record<string, boolean>;
  restructSplitTarget: string | null;
  restructSplitFiles: Record<string, boolean>;
  restructMsg: string;
  restructMsgDirty: boolean;
  restructNew: string;
  restructNewDirty: boolean;
  restructOrig: string;
  restructOrigDirty: boolean;
  restructResultMode: "squash" | "split";

  // ---- sync ----
  syncMode: "rebase" | "merge";
  syncPhase: Phase;

  // ---- cleanup ----
  branchSel: Record<string, boolean>;
  cleanupPhase: "idle" | "running" | "done";
  cleanupDeletedCount: number;
  deleting: Record<string, boolean>;
  deleted: Record<string, boolean>;

  // ---- reflog ----
  reflogMovingTo: string | null;

  // ---- graph ----
  graphFilter: string;
  graphSel: string | null;

  // ---- search ----
  searchMode: "message" | "author" | "file" | "code";
  searchQuery: string;

  // ---- file history ----
  fhFile: string;
  fhSel: string | null;
  fhQuery: string;
  fhFocus: boolean;
  fhOpenedAt: string | null;

  // ---- streaming op state (current operation) ----
  opId: number | null;
  stages: StageView[];
  log: LogView[];

  // ---- fetched git data (filled by queries) ----
  data: GitData;
}

export interface StageView {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "running" | "done" | "error" | "conflict";
  current?: number;
  total?: number;
}

export interface LogView {
  kind: "cmd" | "out" | "pick" | "ok" | "err";
  text: string;
  skip?: string;
}

export interface GitData {
  reforgeCommits: any[] | null;
  restructCommits: any[] | null;
  syncPreview: any | null;
  branches: any[] | null;
  reflog: any[] | null;
  graph: any | null;
  graphFiles: Record<string, any>;
  fileList: string[] | null;
  fileHistory: Record<string, any[]>;
  fileDiffs: Record<string, any>;
  searchResults: any | null;
}

export function initialState(mode: "panel" | "sidebar"): State {
  return {
    mode,
    activeTab: "welcome",
    featureTab: null,
    snapshot: null,
    baseBranch: "",
    baseDropdownOpen: false,
    excluded: {},
    expanded: {},
    reforgePhase: "setup",
    restructMode: "squash",
    restructPhase: "setup",
    restructSel: {},
    restructSplitTarget: null,
    restructSplitFiles: {},
    restructMsg: "",
    restructMsgDirty: false,
    restructNew: "",
    restructNewDirty: false,
    restructOrig: "",
    restructOrigDirty: false,
    restructResultMode: "squash",
    syncMode: "rebase",
    syncPhase: "setup",
    branchSel: {},
    cleanupPhase: "idle",
    cleanupDeletedCount: 0,
    deleting: {},
    deleted: {},
    reflogMovingTo: null,
    graphFilter: "all",
    graphSel: null,
    searchMode: "message",
    searchQuery: "",
    fhFile: "",
    fhSel: null,
    fhQuery: "",
    fhFocus: false,
    fhOpenedAt: null,
    opId: null,
    stages: [],
    log: [],
    data: {
      reforgeCommits: null,
      restructCommits: null,
      syncPreview: null,
      branches: null,
      reflog: null,
      graph: null,
      graphFiles: {},
      fileList: null,
      fileHistory: {},
      fileDiffs: {},
      searchResults: null,
    },
  };
}
