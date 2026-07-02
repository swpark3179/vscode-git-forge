import * as vscode from "vscode";
import { getWebviewHtml } from "./html";
import type { GitForgeController } from "../controller";
import type { ToHost, ToWebview, ViewName } from "../shared/protocol";

/** Singleton WebviewPanel hosting Welcome + the 8 feature views. */
export class GitForgePanel {
  public static current: GitForgePanel | undefined;
  private static readonly viewType = "gitForge.panel";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly controller: GitForgeController;
  private disposables: vscode.Disposable[] = [];
  private pendingView: ViewName;

  public static createOrShow(
    extensionUri: vscode.Uri,
    controller: GitForgeController,
    view: ViewName = "welcome"
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (GitForgePanel.current) {
      GitForgePanel.current.panel.reveal(column, false);
      GitForgePanel.current.navigate(view);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      GitForgePanel.viewType,
      "Git Forge",
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist"),
          vscode.Uri.joinPath(extensionUri, "media"),
        ],
      }
    );

    GitForgePanel.current = new GitForgePanel(panel, extensionUri, controller, view);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    controller: GitForgeController,
    view: ViewName
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.controller = controller;
    this.pendingView = view;

    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "icon.svg");
    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      this.extensionUri,
      "panel"
    );

    this.panel.webview.onDidReceiveMessage(
      (msg: ToHost) => this.onMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private onMessage(msg: ToHost): void {
    // 'ready' is sent once the webview boots; reply with the initial view + snapshot.
    if (msg.type === "ready") {
      this.navigate(this.pendingView);
    }
    this.controller.handleMessage(msg, (m) => this.post(m), "panel");
  }

  public post(msg: ToWebview): void {
    void this.panel.webview.postMessage(msg);
  }

  public navigate(view: ViewName): void {
    this.pendingView = view;
    this.post({ type: "navigate", view });
  }

  public reveal(): void {
    this.panel.reveal(undefined, false);
  }

  private dispose(): void {
    GitForgePanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
