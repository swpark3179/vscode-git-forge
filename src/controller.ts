import * as vscode from "vscode";
import * as path from "path";
import type {
  ToHost,
  ToWebview,
  ViewName,
  RepoSnapshot,
} from "./shared/protocol";
import { GitRunner } from "./git/GitRunner";
import {
  discoverRepo,
  repoRoot,
  currentBranch,
  listBranches,
  detectDefaultBranch,
  aheadBehind,
  dirtyCount,
  masterBehind,
} from "./git/repo";
import { commitsInRange } from "./git/commits";
import { buildGraph, commitFiles } from "./git/graph";
import { searchHistory, type SearchMode } from "./git/search";
import {
  listTrackedFiles,
  fileHistory,
  fileVersionDiff,
} from "./git/fileHistory";
import { VersionProvider } from "./git/VersionProvider";
import { readReflog } from "./git/reflog";
import { classifyBranches } from "./git/branches";
import { runSync } from "./git/ops/sync";
import { runReforge } from "./git/ops/reforge";
import { runRestructure } from "./git/ops/restructure";
import { runCleanup } from "./git/ops/cleanup";
import { restoreReflog, undoLast } from "./git/ops/recovery";
import type { OpEmitter } from "./git/ops/opbase";
import type { LogLine, StageUpdate } from "./shared/protocol";

type Post = (msg: ToWebview) => void;

/** Owns repo state and brokers messages between the host and both webviews. */
export class GitForgeController {
  private git: GitRunner | null = null;
  private gitFolder: string | null = null;
  public onOpenView?: (view: ViewName) => void;

  constructor(private readonly context: vscode.ExtensionContext) {
    void this.context;
  }

  public openView(view: ViewName): void {
    this.onOpenView?.(view);
  }

  public handleMessage(msg: ToHost, post: Post, _source: "panel" | "sidebar"): void {
    switch (msg.type) {
      case "ready":
        void this.sendSnapshot(post);
        return;
      case "open":
        this.openView(msg.view);
        return;
      case "navigate":
        return;
      case "query":
        void this.handleQuery(msg.id, msg.name, msg.args, post);
        return;
      case "operation":
        void this.handleOperation(msg.id, msg.name, msg.args, post);
        return;
      case "cancel":
        return;
    }
  }

  private activeFolder(): string | undefined {
    const ed = vscode.window.activeTextEditor;
    if (ed && ed.document.uri.scheme === "file") {
      const wf = vscode.workspace.getWorkspaceFolder(ed.document.uri);
      if (wf) return wf.uri.fsPath;
      return path.dirname(ed.document.uri.fsPath);
    }
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length) return folders[0].uri.fsPath;
    return undefined;
  }

  /** Resolve (and cache) a GitRunner for the active repo. */
  private async resolveGit(force = false): Promise<GitRunner | null> {
    const folder = this.activeFolder();
    if (!folder) {
      this.git = null;
      this.gitFolder = null;
      return null;
    }
    if (!force && this.git && this.gitFolder === folder) return this.git;
    this.gitFolder = folder;
    this.git = await discoverRepo(folder);
    return this.git;
  }

  public getGit(): GitRunner | null {
    return this.git;
  }

  private async sendSnapshot(post: Post): Promise<void> {
    post({ type: "snapshot", data: await this.getSnapshot() });
  }

  private async handleQuery(
    id: number,
    name: string,
    args: any,
    post: Post
  ): Promise<void> {
    try {
      const data = await this.runQuery(name, args);
      post({ type: "result", id, ok: true, data });
    } catch (e: any) {
      post({ type: "result", id, ok: false, error: e?.message ?? String(e) });
    }
  }

  private async runQuery(name: string, args: any): Promise<any> {
    if (name === "snapshot") return this.getSnapshot(true);

    const git = await this.resolveGit();
    if (!git) throw new Error("git 저장소를 찾을 수 없습니다.");
    const base = args?.base || (await detectDefaultBranch(git));

    switch (name) {
      case "reforgeSetup":
        return { base, commits: await commitsInRange(git, base) };
      case "restructCommits":
        return { commits: await commitsInRange(git, base) };
      case "graph":
        return buildGraph(git, { all: args?.all !== false, max: args?.max });
      case "graphCommitFiles":
        return commitFiles(git, args.hash);
      case "search":
        return {
          results: await searchHistory(
            git,
            (args?.mode ?? "message") as SearchMode,
            args?.query ?? ""
          ),
        };
      case "fileList":
        return { files: await listTrackedFiles(git) };
      case "fileHistory":
        return { versions: await fileHistory(git, args.path) };
      case "fileDiff":
        return fileVersionDiff(git, args.hash, args.path);
      case "reflog":
        return { entries: await readReflog(git) };
      case "branches": {
        const cfg = vscode.workspace.getConfiguration("gitForge");
        return {
          branches: await classifyBranches(git, {
            def: base,
            protectedGlobs: cfg.get<string[]>("protectedBranches", []),
            staleDays: cfg.get<number>("staleDays", 60),
          }),
        };
      }
      case "syncPreview": {
        await git.tryRun(["fetch", "origin", base, "--prune"]);
        const r = await git.tryRun([
          "log",
          "--reverse",
          `--pretty=tformat:%h\x1f%s\x1f%an`,
          `${base}..origin/${base}`,
        ]);
        const incoming = r.stdout
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            const [hash, msg, author] = l.split("\x1f");
            return { hash, msg, author };
          });
        return { def: base, incoming };
      }
      default:
        return null; // branches / restruct exec: later phases
    }
  }

  private async confirm(message: string): Promise<boolean> {
    const yes = "실행";
    const r = await vscode.window.showWarningMessage(message, { modal: true }, yes);
    return r === yes;
  }

  private async confirmedStreamOp(
    id: number,
    post: Post,
    message: string,
    fn: (emit: OpEmitter) => Promise<any>
  ): Promise<void> {
    if (!(await this.confirm(message))) {
      post({ type: "done", id, summary: { cancelled: true } });
      return;
    }
    await this.streamOp(id, post, fn);
  }

  private async streamOp(
    id: number,
    post: Post,
    fn: (emit: OpEmitter) => Promise<any>
  ): Promise<void> {
    const emit: OpEmitter = {
      stage: (s: StageUpdate) => post({ type: "stage", id, stage: s }),
      log: (l: LogLine) => post({ type: "log", id, line: l }),
    };
    try {
      const summary = await fn(emit);
      post({ type: "done", id, summary });
    } catch (e: any) {
      post({ type: "error", id, message: e?.message ?? String(e) });
    }
  }

  private async handleOperation(
    id: number,
    name: string,
    args: any,
    post: Post
  ): Promise<void> {
    try {
      if (name === "openVersion") {
        const uri = VersionProvider.makeUri(args.path, args.hash);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
        post({ type: "done", id, summary: { opened: args.path } });
        return;
      }

      const git = await this.resolveGit();
      if (!git) throw new Error("git 저장소를 찾을 수 없습니다.");

      if (name === "sync") {
        await this.streamOp(id, post, (emit) => runSync(git, args, emit));
        return;
      }
      if (name === "undo") {
        await this.streamOp(id, post, (emit) => undoLast(git, emit));
        return;
      }
      if (name === "reforge") {
        const n = (args.exclude || []).length;
        await this.confirmedStreamOp(id, post, `${n}개 파일을 브랜치 히스토리에서 제거합니다. 백업 ref가 생성되어 되돌릴 수 있습니다. 계속할까요?`, (emit) => runReforge(git, args, emit));
        return;
      }
      if (name === "restructure") {
        const msg = args.mode === "squash" ? `${(args.hashes || []).length}개 커밋을 하나로 합칩니다. 계속할까요?` : `커밋을 2개로 나눕니다. 계속할까요?`;
        await this.confirmedStreamOp(id, post, msg, (emit) => runRestructure(git, args, emit));
        return;
      }
      if (name === "cleanup") {
        await this.confirmedStreamOp(id, post, `${(args.branches || []).length}개 브랜치를 삭제합니다. reflog로 복구할 수 있습니다. 계속할까요?`, (emit) => runCleanup(git, args, emit));
        return;
      }
      if (name === "restoreReflog") {
        await this.confirmedStreamOp(id, post, `HEAD를 ${args.hash} 상태로 되돌립니다(reset --hard). 현재 상태는 백업됩니다. 계속할까요?`, (emit) => restoreReflog(git, args, emit));
        return;
      }

      post({ type: "error", id, message: "알 수 없는 작업입니다." });
    } catch (e: any) {
      post({ type: "error", id, message: e?.message ?? String(e) });
    }
  }

  private async getSnapshot(force = false): Promise<RepoSnapshot> {
    const git = await this.resolveGit(force);
    if (!git) {
      return emptySnapshot(
        "현재 작업 폴더에서 git 저장소를 찾을 수 없습니다. 저장소가 있는 폴더를 여세요."
      );
    }
    try {
      const root = await repoRoot(git);
      const base = await detectDefaultBranch(git);
      const [cur, branches, ab, dirty, behindMaster] = await Promise.all([
        currentBranch(git),
        listBranches(git),
        aheadBehind(git, base),
        dirtyCount(git),
        masterBehind(git, base),
      ]);
      return {
        repoRoot: root,
        repoName: path.basename(root),
        hasRepo: true,
        currentBranch: cur,
        baseBranch: base,
        branches,
        ahead: ab.ahead,
        behind: ab.behind,
        dirtyCount: dirty,
        masterBehind: behindMaster,
      };
    } catch (e: any) {
      return emptySnapshot(`git 정보를 읽는 중 오류: ${e?.message ?? String(e)}`);
    }
  }
}

function emptySnapshot(error: string): RepoSnapshot {
  return {
    repoRoot: "",
    repoName: "",
    hasRepo: false,
    currentBranch: "—",
    baseBranch: "—",
    branches: [],
    ahead: 0,
    behind: 0,
    dirtyCount: 0,
    masterBehind: 0,
    error,
  };
}
