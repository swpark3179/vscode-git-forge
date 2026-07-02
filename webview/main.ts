import { delegate, wireHover, type HandlerMap } from "./dom";
import { initialState, type State, type StageView } from "./state";
import { renderPanel } from "./render";
import { renderSidebar } from "./sidebar";
import type {
  ToHost,
  ToWebview,
  ViewName,
  QueryName,
  OpName,
  StageUpdate,
} from "../src/shared/protocol";

// Side-effect imports: register feature body renderers.
import "./views/reforge";
import "./views/graph";
import "./views/search";
import "./views/filehist";
import "./views/reflog";
import "./views/sync";
import "./views/restruct";
import "./views/cleanup";

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(s: unknown): void;
};

const vscode = acquireVsCodeApi();
const rootEl = document.getElementById("root") as HTMLElement;
const mode = (rootEl.getAttribute("data-mode") as "panel" | "sidebar") || "panel";
const state: State = initialState(mode);

function post(msg: ToHost): void {
  vscode.postMessage(msg);
}

// ---- request/response ----
let nextId = 1;
const pending = new Map<number, { resolve: (d: any) => void; reject: (e: any) => void }>();

function query(name: QueryName, args?: any): Promise<any> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    post({ id, type: "query", name, args });
  });
}

const opHandlers = new Map<number, (msg: ToWebview) => void>();
function operation(name: OpName, args: any, onEvent: (msg: ToWebview) => void): number {
  const id = nextId++;
  state.opId = id;
  opHandlers.set(id, onEvent);
  post({ id, type: "operation", name, args });
  return id;
}

// ---- render (with input focus restore) ----
let scheduled = false;
let pendingFocus: { id: string; start: number | null } | null = null;
function render(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    rootEl.innerHTML = mode === "sidebar" ? renderSidebar(state) : renderPanel(state);
    wireHover(rootEl);
    if (pendingFocus) {
      const el = document.getElementById(pendingFocus.id) as HTMLInputElement | null;
      if (el) {
        el.focus();
        const pos = pendingFocus.start ?? el.value.length;
        try { el.setSelectionRange(pos, pos); } catch { /* non-text input */ }
      }
      pendingFocus = null;
    }
  });
}

// ---- generic streaming op runner ----
function applyStage(su: StageUpdate): void {
  let s = state.stages.find((x) => x.id === su.id);
  if (!s) {
    s = { id: su.id, label: su.label ?? su.id, detail: "", status: "pending" } as StageView;
    state.stages.push(s);
  }
  if (su.label !== undefined) s.label = su.label;
  if (su.status !== undefined) s.status = su.status;
  if (su.current !== undefined) s.current = su.current;
  if (su.total !== undefined) s.total = su.total;
  if (su.detail !== undefined) s.detail = su.detail;
}

function startOp(
  opName: OpName,
  args: any,
  setPhase: (p: State["reforgePhase"]) => void
): void {
  state.stages = [];
  state.log = [];
  setPhase("running");
  render();
  operation(opName, args, (msg) => {
    if (msg.type === "stage") applyStage(msg.stage);
    else if (msg.type === "log") state.log.push(msg.line);
    else if (msg.type === "done") setPhase((msg.summary && msg.summary.cancelled) ? "setup" : "done");
    else if (msg.type === "error") {
      state.log.push({ kind: "err", text: msg.message });
      setPhase("error");
    }
    render();
  });
}

// ---- per-view data loading ----
function baseArg() {
  return { base: state.baseBranch || state.snapshot?.baseBranch };
}

async function loadView(view: ViewName, force = false): Promise<void> {
  const git = state.snapshot?.hasRepo;
  if (!git) return;
  try {
    if (view === "reforge") {
      if (state.data.reforgeCommits === null || force) {
        const d = await query("reforgeSetup", baseArg());
        state.data.reforgeCommits = d.commits;
        render();
      }
    } else if (view === "graph") {
      if (state.data.graph === null || force) {
        const d = await query("graph", { all: true });
        state.data.graph = d;
        if (!state.graphSel && d.nodes?.length) {
          state.graphSel = d.nodes[0].id;
          void selectGraphCommit(d.nodes[0].id);
        }
        render();
      }
    } else if (view === "filehist") {
      if (state.data.fileList === null || force) {
        const d = await query("fileList");
        state.data.fileList = d.files;
        render();
      }
      if (!state.fhFile && state.data.fileList && state.data.fileList.length) {
        state.fhFile = state.data.fileList[0];
      }
      if (state.fhFile && !state.data.fileHistory[state.fhFile]) {
        await loadFileHistory(state.fhFile);
      }
    } else if (view === "search") {
      if (state.searchQuery.trim()) await doSearch();
    } else if (view === "reflog") {
      if (state.data.reflog === null || force) {
        const d = await query("reflog");
        state.data.reflog = d.entries;
        render();
      }
    } else if (view === "sync") {
      if (state.data.syncPreview === null || force) {
        const d = await query("syncPreview", baseArg());
        state.data.syncPreview = d;
        render();
      }
    } else if (view === "restruct") {
      if (state.data.restructCommits === null || force) {
        const d = await query("restructCommits", baseArg());
        state.data.restructCommits = d.commits;
        render();
      }
    } else if (view === "cleanup") {
      if (state.data.branches === null || force) {
        const d = await query("branches", baseArg());
        state.data.branches = d.branches;
        render();
      }
    }
  } catch (e: any) {
    state.log.push({ kind: "err", text: e?.message ?? String(e) });
    render();
  }
}

async function loadFileHistory(path: string): Promise<void> {
  const d = await query("fileHistory", { path });
  state.data.fileHistory[path] = d.versions;
  if (!state.fhSel && d.versions?.length) state.fhSel = d.versions[0].hash;
  render();
  if (state.fhSel) void loadFileDiff(path, state.fhSel);
}

async function loadFileDiff(path: string, hash: string): Promise<void> {
  const key = `${path}@${hash}`;
  if (state.data.fileDiffs[key]) return;
  const d = await query("fileDiff", { path, hash });
  state.data.fileDiffs[key] = d;
  render();
}

async function selectGraphCommit(id: string): Promise<void> {
  if (state.data.graphFiles[id]) return;
  const d = await query("graphCommitFiles", { hash: id });
  state.data.graphFiles[id] = d;
  render();
}

let searchTimer: any = null;
async function doSearch(): Promise<void> {
  const d = await query("search", { mode: state.searchMode, query: state.searchQuery });
  state.data.searchResults = d;
  render();
}
function scheduleSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (state.searchQuery.trim()) void doSearch();
    else { state.data.searchResults = null; render(); }
  }, 250);
}

// ---- navigation ----
function openView(view: ViewName): void {
  if (mode === "sidebar") { post({ type: "open", view }); return; }
  navigateLocal(view);
}
function navigateLocal(view: ViewName): void {
  if (view !== "welcome") state.featureTab = view;
  state.activeTab = view;
  post({ type: "navigate", view });
  render();
  void loadView(view);
}

// ---- handlers ----
const handlers: HandlerMap = {
  openReforge: () => openView("reforge"),
  openRestruct: () => openView("restruct"),
  openSync: () => openView("sync"),
  openCleanup: () => openView("cleanup"),
  openReflog: () => openView("reflog"),
  openGraph: () => openView("graph"),
  openSearch: () => openView("search"),
  openFileHist: () => openView("filehist"),
  openWelcome: () => navigateLocal("welcome"),

  activateTab: ({ arg }) => { if (arg) navigateLocal(arg as ViewName); },
  closeTab: ({ arg, event }) => {
    event.stopPropagation();
    if (arg && state.featureTab === arg) {
      state.featureTab = null;
      state.activeTab = "welcome";
      render();
    }
  },
  refresh: async () => {
    const snap = await query("snapshot");
    if (snap) state.snapshot = snap;
    // invalidate caches
    state.data.reforgeCommits = null;
    state.data.graph = null;
    state.data.fileList = null;
    state.data.fileHistory = {};
    state.data.searchResults = null;
    render();
    void loadView(state.activeTab, true);
  },

  // reforge
  toggleBaseDropdown: () => { state.baseDropdownOpen = !state.baseDropdownOpen; render(); },
  reforgeChooseBase: ({ arg }) => {
    if (arg) state.baseBranch = arg;
    state.baseDropdownOpen = false;
    state.data.reforgeCommits = null;
    render();
    void loadView("reforge", true);
  },
  reforgeToggleExpand: ({ arg }) => {
    if (arg) state.expanded[arg] = !state.expanded[arg];
    render();
  },
  reforgeToggleFile: ({ arg }) => {
    if (arg) { if (state.excluded[arg]) delete state.excluded[arg]; else state.excluded[arg] = true; }
    render();
  },
  runReforge: () => {
    const ex = Object.keys(state.excluded).filter((p) => state.excluded[p]);
    if (!ex.length) return;
    startOp("reforge", { base: state.baseBranch || state.snapshot?.baseBranch, exclude: ex },
      (p) => { state.reforgePhase = p; });
  },
  reforgeBackToSetup: () => {
    state.reforgePhase = "setup";
    state.excluded = {};
    state.data.reforgeCommits = null;
    render();
    void loadView("reforge", true);
  },
  undoLast: () => { startOp("undo", {}, (p) => { state.reforgePhase = p; state.syncPhase = p; }); },

  // sync
  syncSetRebase: () => { state.syncMode = "rebase"; render(); },
  syncSetMerge: () => { state.syncMode = "merge"; render(); },
  runSync: () => {
    startOp("sync", { mode: state.syncMode, def: state.baseBranch || state.snapshot?.baseBranch },
      (p) => { state.syncPhase = p; });
  },
  syncReset: () => {
    state.syncPhase = "setup";
    state.data.syncPreview = null;
    render();
    void loadView("sync", true);
  },

  // reflog
  reflogRestore: ({ arg }) => {
    if (!arg) return;
    state.reflogMovingTo = arg;
    render();
    operation("restoreReflog", { hash: arg }, (msg) => {
      if (msg.type === "done") {
        state.reflogMovingTo = null;
        state.data.reflog = null;
        query("snapshot").then((s) => { if (s) state.snapshot = s; });
        render();
        void loadView("reflog", true);
      } else if (msg.type === "error") {
        state.reflogMovingTo = null;
        state.log.push({ kind: "err", text: msg.message });
        render();
      }
    });
  },

  // restructure
  restructSetSquash: () => { state.restructMode = "squash"; render(); },
  restructSetSplit: () => { state.restructMode = "split"; render(); },
  restructToggleSel: ({ arg }) => {
    if (arg) { if (state.restructSel[arg]) delete state.restructSel[arg]; else state.restructSel[arg] = true; }
    state.restructMsgDirty = false;
    render();
  },
  restructSetSplitTarget: ({ arg }) => {
    state.restructSplitTarget = arg ?? null;
    state.restructSplitFiles = {};
    state.restructNewDirty = false;
    state.restructOrigDirty = false;
    render();
  },
  restructToggleSplitFile: ({ arg }) => {
    if (arg) { if (state.restructSplitFiles[arg]) delete state.restructSplitFiles[arg]; else state.restructSplitFiles[arg] = true; }
    render();
  },
  restructMsgInput: ({ value, el }) => { state.restructMsg = value; state.restructMsgDirty = true; pendingFocus = { id: el.id, start: (el as HTMLInputElement).selectionStart }; render(); },
  restructNewInput: ({ value, el }) => { state.restructNew = value; state.restructNewDirty = true; pendingFocus = { id: el.id, start: (el as HTMLInputElement).selectionStart }; render(); },
  restructOrigInput: ({ value, el }) => { state.restructOrig = value; state.restructOrigDirty = true; pendingFocus = { id: el.id, start: (el as HTMLInputElement).selectionStart }; render(); },
  runRestruct: () => {
    const commits = (state.data.restructCommits as any[]) ?? [];
    const base = state.baseBranch || state.snapshot?.baseBranch;
    if (state.restructMode === "squash") {
      const hashes = commits.filter((c) => state.restructSel[c.hash]).map((c) => c.hash);
      if (hashes.length < 2) return;
      const oldestFirst = commits.filter((c) => state.restructSel[c.hash]).reverse();
      const message = state.restructMsgDirty ? state.restructMsg : oldestFirst.map((c) => c.message).join("\n");
      state.restructResultMode = "squash";
      startOp("restructure", { mode: "squash", base, hashes, message }, (p) => { state.restructPhase = p; });
    } else {
      const target = state.restructSplitTarget;
      const tc = commits.find((c) => c.hash === target);
      if (!target || !tc) return;
      const outFiles = tc.files.filter((f: any) => state.restructSplitFiles[f.path]).map((f: any) => f.path);
      if (!outFiles.length || outFiles.length >= tc.files.length) return;
      state.restructResultMode = "split";
      startOp("restructure", {
        mode: "split", base, target, outFiles,
        newMsg: state.restructNewDirty ? state.restructNew : "",
        origMsg: state.restructOrigDirty ? state.restructOrig : tc.message,
      }, (p) => { state.restructPhase = p; });
    }
  },
  restructReset: () => {
    state.restructPhase = "setup";
    state.restructSel = {};
    state.restructSplitTarget = null;
    state.restructSplitFiles = {};
    state.restructMsgDirty = state.restructNewDirty = state.restructOrigDirty = false;
    state.data.restructCommits = null;
    render();
    void loadView("restruct", true);
  },

  // cleanup
  cleanupToggle: ({ arg }) => {
    if (arg) { if (state.branchSel[arg]) delete state.branchSel[arg]; else state.branchSel[arg] = true; }
    render();
  },
  cleanupSelectMerged: () => {
    const branches = (state.data.branches as any[]) ?? [];
    state.branchSel = {};
    for (const b of branches) if (b.kind === "merged" || b.kind === "stale") state.branchSel[b.name] = true;
    render();
  },
  runCleanup: () => {
    const branches = (state.data.branches as any[]) ?? [];
    const selNames = Object.keys(state.branchSel).filter((n) => state.branchSel[n]);
    const sel = selNames.map((n) => ({ name: n, merged: branches.find((b) => b.name === n)?.kind === "merged" }));
    if (!sel.length || state.cleanupPhase === "running") return;
    state.cleanupPhase = "running";
    render();
    operation("cleanup", { branches: sel }, (msg) => {
      if (msg.type === "done") {
        if (msg.summary && msg.summary.cancelled) { state.cleanupPhase = "idle"; render(); return; }
        state.cleanupPhase = "done";
        state.cleanupDeletedCount = msg.summary?.deleted?.length ?? sel.length;
        state.branchSel = {};
        state.data.branches = null;
        render();
        void loadView("cleanup", true);
        query("snapshot").then((s) => { if (s) state.snapshot = s; render(); });
      } else if (msg.type === "error") {
        state.cleanupPhase = "idle";
        state.log.push({ kind: "err", text: msg.message });
        render();
      }
    });
  },

  // graph
  graphFilter: ({ arg }) => { if (arg) state.graphFilter = arg; render(); },
  graphSelect: ({ arg }) => { if (arg) { state.graphSel = arg; render(); void selectGraphCommit(arg); } },

  // search
  searchMode: ({ arg }) => {
    if (arg) state.searchMode = arg as State["searchMode"];
    render();
    if (state.searchQuery.trim()) void doSearch();
  },
  searchInput: ({ value, el }) => {
    state.searchQuery = value;
    pendingFocus = { id: el.id, start: (el as HTMLInputElement).selectionStart };
    render();
    scheduleSearch();
  },

  // file history
  fhSearchInput: ({ value, el }) => {
    state.fhQuery = value;
    state.fhFocus = true;
    pendingFocus = { id: el.id, start: (el as HTMLInputElement).selectionStart };
    render();
  },
  fhFocusOn: () => { state.fhFocus = true; render(); },
  fhFocusOff: () => { setTimeout(() => { state.fhFocus = false; render(); }, 160); },
  fhChoose: ({ arg }) => {
    if (!arg) return;
    state.fhFile = arg;
    state.fhSel = null;
    state.fhQuery = "";
    state.fhFocus = false;
    render();
    void loadFileHistory(arg);
  },
  fhSelect: ({ arg }) => {
    if (!arg) return;
    state.fhSel = arg;
    render();
    void loadFileDiff(state.fhFile, arg);
  },
  fhOpenVersion: () => {
    const hash = state.fhSel;
    if (!hash) return;
    operation("openVersion", { path: state.fhFile, hash }, (msg) => {
      if (msg.type === "done") {
        state.fhOpenedAt = hash;
        render();
        setTimeout(() => { if (state.fhOpenedAt === hash) { state.fhOpenedAt = null; render(); } }, 2600);
      } else if (msg.type === "error") {
        state.log.push({ kind: "err", text: msg.message });
        render();
      }
    });
  },
};

delegate(rootEl, handlers);

// ---- incoming messages ----
window.addEventListener("message", (e: MessageEvent<ToWebview>) => {
  const msg = e.data;
  switch (msg.type) {
    case "snapshot":
      state.snapshot = msg.data;
      if (!state.baseBranch) state.baseBranch = msg.data.baseBranch;
      render();
      if (mode === "panel" && state.activeTab !== "welcome") void loadView(state.activeTab);
      return;
    case "navigate":
      if (mode === "panel") navigateLocal(msg.view);
      return;
    case "result": {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.data);
        else p.reject(new Error(msg.error || "query failed"));
      }
      return;
    }
    case "stage":
    case "log":
    case "done":
    case "error": {
      const h = opHandlers.get(msg.id);
      if (h) h(msg);
      if (msg.type === "done" || msg.type === "error") opHandlers.delete(msg.id);
      return;
    }
  }
});

post({ type: "ready" });
render();
