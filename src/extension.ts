import * as vscode from "vscode";
import { tryAcquirePositronApi } from "@posit-dev/positron";
import { McpConsoleServer } from "./server";
import { EXTENSION_VERSION } from "./version";

let mcpServer: McpConsoleServer | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;
let restartDisposable: vscode.Disposable | null = null;
let outputChannel: vscode.OutputChannel | null = null;

/**
 * Activate the extension — start the MCP server and set up status bar + commands.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Positron Console MCP");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine(
    `[${new Date().toISOString()}] Activating Positron Console MCP v${EXTENSION_VERSION}`,
  );

  // Check Positron API availability (logs warning, does not block activation)
  const positronApi = tryAcquirePositronApi();
  if (!positronApi) {
    const warnMsg =
      "[PositronConsoleMCP] Positron API not available. " +
      "Running in standard VS Code — console/session tools will not work, " +
      "but other IDE tools (editor context, viewer, etc.) may be limited or unavailable.";
    console.warn(warnMsg);
    outputChannel.appendLine(`[warn] ${warnMsg}`);
  } else {
    outputChannel.appendLine("[info] Positron API acquired successfully.");
  }

  // Determine port from configuration
  const config = vscode.workspace.getConfiguration("positronConsoleMcp");
  const port = config.get<number>("port") ?? 0;
  outputChannel.appendLine(`[info] Configured port: ${port} (0 = OS-assigned)`);

  // Create and start the MCP server
  mcpServer = new McpConsoleServer(port);
  try {
    const actualPort = await mcpServer.start();
    const successMsg = `[info] MCP server listening on http://127.0.0.1:${actualPort}/mcp`;
    console.log(`[PositronConsoleMCP] ${successMsg}`);
    outputChannel.appendLine(successMsg);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[error] Failed to start server: ${message}`);
    void vscode.window.showErrorMessage(
      `Positron Console MCP: Failed to start on port ${port} — ${message}`,
      "Show Details",
    ).then((sel) => { if (sel === "Show Details") outputChannel?.show(); });
    return;
  }

  // ── MCP server definition provider ─────────────────────────────
  // Registers this server so it automatically appears in
  // Extensions → MCP SERVERS → Installed (with its logo).
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(
      "positron-console-mcp",
      {
        provideMcpServerDefinitions: async () => {
          const port = mcpServer!.getPort();
          return [
            new vscode.McpHttpServerDefinition(
              "Positron Console MCP",
              vscode.Uri.parse(`http://localhost:${port}/mcp`),
              {},
              EXTENSION_VERSION
            ),
          ];
        },
      }
    )
  );

  // ── Status bar item ────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ── Commands ───────────────────────────────────────────────────

  // Show Status
  context.subscriptions.push(
    vscode.commands.registerCommand("positronConsoleMcp.showStatus", async () => {
      const port = mcpServer?.getPort();
      const running = mcpServer?.isRunning() ?? false;
      const apiAvailable = tryAcquirePositronApi() !== null;
      const ts = new Date().toISOString();

      const lines = [
        `=== Positron Console MCP v${EXTENSION_VERSION} ===`,
        `Time:            ${ts}`,
        `Server running:  ${running}`,
        `Bound port:      ${port ?? "(none)"}`,
        `Endpoint:        http://localhost:${port ?? "?"}/mcp`,
        `Positron API:    ${apiAvailable ? "Available" : "Not available"}`,
        `Output channel:  "Positron Console MCP" (this panel)`,
        ``,
        `Commands:`,
        `  Show Status          — this dialog`,
        `  Copy MCP Config      — copy .omp/agent/mcp.json entry to clipboard`,
        `  Add to .vscode/mcp.json — add to workspace config`,
        `  Restart Server       — restart the HTTP listener`,
        ``,
        `If the server is running but your MCP client can't reach it,`,
        `check that the port matches the url in your client's config.`,
      ];

      if (outputChannel) {
        for (const line of lines) outputChannel.appendLine(line);
        outputChannel.appendLine("---");
        outputChannel.show(true); // true = preserve focus, don't steal it
      }

      // Short toast — single line, with action button
      const summary = running
        ? `Positron Console MCP running on port ${port}`
        : "Positron Console MCP: server not running";
      const action = await vscode.window.showInformationMessage(
        summary,
        "Open Output",
      );
      if (action === "Open Output" && outputChannel) {
        outputChannel.show();
      }
    })
  );

  // Copy MCP Configuration
  context.subscriptions.push(
    vscode.commands.registerCommand("positronConsoleMcp.copyMcpConfig", async () => {
      if (!mcpServer) {
        vscode.window.showErrorMessage("Positron Console MCP: Server not running");
        return;
      }
      const port = mcpServer.getPort();
      const config = {
        servers: {
          "positron-console-mcp": {
            type: "http",
            url: `http://localhost:${port}/mcp`,
            serverName: "positron-console-mcp",
          },
        },
      };
      await vscode.env.clipboard.writeText(JSON.stringify(config, null, 2));
      vscode.window.showInformationMessage(
        "MCP configuration copied to clipboard. Paste it into your .vscode/mcp.json or user settings."
      );
    })
  );

  // Add to .vscode/mcp.json
  context.subscriptions.push(
    vscode.commands.registerCommand("positronConsoleMcp.addToMcpJson", async () => {
      if (!mcpServer) {
        vscode.window.showErrorMessage("Positron Console MCP: Server not running");
        return;
      }
      const port = mcpServer.getPort();
      try {
        await vscode.commands.executeCommand(
          "workbench.action.addToMcpJson",
          "positron-console-mcp",
          "http",
          `http://localhost:${port}/mcp`
        );
      } catch {
        // Fallback: copy to clipboard
        const config = {
          servers: {
            "positron-console-mcp": {
              type: "http",
              url: `http://localhost:${port}/mcp`,
              serverName: "positron-console-mcp",
            },
          },
        };
        await vscode.env.clipboard.writeText(JSON.stringify(config, null, 2));
        vscode.window.showInformationMessage(
          "Could not auto-add to mcp.json. Configuration copied to clipboard instead."
        );
      }
    })
  );

  // Restart Server
  restartDisposable = vscode.commands.registerCommand(
    "positronConsoleMcp.restart",
    async () => {
      if (!mcpServer) return;
      const oldPort = mcpServer.getPort();
      outputChannel?.appendLine(`[info] Restarting server (was on port ${oldPort})...`);
      // Fire-and-forget toast; do NOT await (would block the restart until dismissed)
      void vscode.window.showInformationMessage(
        "Restarting Positron Console MCP server...",
        "Show Output",
      ).then((sel) => { if (sel === "Show Output") outputChannel?.show(); });
      try {
        await mcpServer.stop();
        const newPort = await mcpServer.start();
        updateStatusBar();
        outputChannel?.appendLine(
          `[info] Server restarted on port ${newPort}` +
            (newPort !== oldPort ? ` (changed from ${oldPort})` : ""),
        );
        vscode.window.showInformationMessage(
          `Positron Console MCP: restarted on port ${newPort}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel?.appendLine(`[error] Restart failed: ${message}`);
        vscode.window.showErrorMessage(`Failed to restart MCP server: ${message}`);
      }
    }
  );
  context.subscriptions.push(restartDisposable);

  outputChannel?.appendLine("[info] Activation complete.");
}

/**
 * Deactivate the extension — stop the MCP server.
 */
export async function deactivate(): Promise<void> {
  console.log("[PositronConsoleMCP] Deactivating...");
  if (mcpServer) {
    await mcpServer.stop();
    mcpServer = null;
  }
  if (restartDisposable) {
    restartDisposable.dispose();
    restartDisposable = null;
  }
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = null;
  }
  if (outputChannel) {
    outputChannel.appendLine("[info] Deactivation complete.");
    outputChannel.dispose();
    outputChannel = null;
  }
}

/**
 * Update the status bar item text and tooltip.
 */
function updateStatusBar(): void {
  if (!statusBarItem || !mcpServer) return;

  const port = mcpServer.getPort();
  const running = mcpServer.isRunning();
  const apiAvailable = tryAcquirePositronApi() !== null;

  if (running) {
    statusBarItem.text = `$(debug-console) Console MCP :${port}`;
    statusBarItem.tooltip = `Positron Console MCP v${EXTENSION_VERSION} — Listening on port ${port}\nPositron API: ${apiAvailable ? "Available" : "Not available"}\nClick to show status`;
    statusBarItem.command = "positronConsoleMcp.showStatus";
    statusBarItem.color = apiAvailable ? undefined : new vscode.ThemeColor("statusBarItem.warningForeground");
  } else {
    statusBarItem.text = "$(debug-console) Console MCP (stopped)";
    statusBarItem.tooltip = "Positron Console MCP — Server stopped";
    statusBarItem.command = "positronConsoleMcp.restart";
    statusBarItem.color = new vscode.ThemeColor("statusBarItem.errorForeground");
  }
}