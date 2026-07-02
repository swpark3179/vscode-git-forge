import * as vscode from "vscode";
import { GitForgeController } from "./controller";
import { GitForgePanel } from "./panel/GitForgePanel";
import { SidebarProvider } from "./panel/SidebarProvider";
import { VersionProvider, GITFORGE_SCHEME } from "./git/VersionProvider";
import type { ViewName } from "./shared/protocol";

export function activate(context: vscode.ExtensionContext): void {
  const controller = new GitForgeController(context);

  controller.onOpenView = (view: ViewName) => {
    GitForgePanel.createOrShow(context.extensionUri, controller, view);
  };

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      GITFORGE_SCHEME,
      new VersionProvider(() => controller.getGit())
    )
  );

  const sidebar = new SidebarProvider(context.extensionUri, controller);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gitForge.openWelcome", () => {
      GitForgePanel.createOrShow(context.extensionUri, controller, "welcome");
    }),
    vscode.commands.registerCommand("gitForge.open", (view?: ViewName) => {
      GitForgePanel.createOrShow(context.extensionUri, controller, view ?? "welcome");
    }),
    vscode.commands.registerCommand("gitForge.refresh", () => {
      vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
    })
  );
}

export function deactivate(): void {
  // no-op
}
