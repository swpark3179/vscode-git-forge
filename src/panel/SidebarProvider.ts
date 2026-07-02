import * as vscode from "vscode";
import { getWebviewHtml } from "./html";
import type { GitForgeController } from "../controller";
import type { ToHost, ToWebview } from "../shared/protocol";

/** The Git Forge activity-bar sidebar (a styled WebviewView, not a TreeView). */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "gitForge.sidebar";

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: GitForgeController
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "dist"),
        vscode.Uri.joinPath(this.extensionUri, "media"),
      ],
    };
    webviewView.webview.html = getWebviewHtml(
      webviewView.webview,
      this.extensionUri,
      "sidebar"
    );
    webviewView.webview.onDidReceiveMessage((msg: ToHost) => {
      this.controller.handleMessage(msg, (m) => this.post(m), "sidebar");
    });
  }

  public post(msg: ToWebview): void {
    void this.view?.webview.postMessage(msg);
  }
}
