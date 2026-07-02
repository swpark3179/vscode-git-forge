import * as vscode from "vscode";
import { fileAtCommit } from "./fileHistory";
import type { GitRunner } from "./GitRunner";

export const GITFORGE_SCHEME = "gitforge";

/** Serves read-only file contents at a specific commit (gitforge:/path?hash). */
export class VersionProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly getGit: () => GitRunner | null) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const git = this.getGit();
    if (!git) return "// Git Forge: 저장소를 찾을 수 없습니다.";
    const path = uri.path.replace(/^\//, "");
    const hash = uri.query;
    try {
      return await fileAtCommit(git, hash, path);
    } catch (e: any) {
      return `// Git Forge: ${path} @ ${hash} 를 읽을 수 없습니다.\n// ${e?.message ?? e}`;
    }
  }

  static makeUri(path: string, hash: string): vscode.Uri {
    return vscode.Uri.from({ scheme: GITFORGE_SCHEME, path: "/" + path, query: hash });
  }
}
