/**
 * Typed adapter around the @posit-dev/positron PositronApi.
 *
 * The @posit-dev/positron SDK has incomplete TypeScript types — many runtime
 * methods accept or return objects that are not fully described in the type
 * definitions. This adapter defines local interfaces for those shapes and
 * provides properly typed wrappers, eliminating the need for `as any` casts
 * in the service layer.
 *
 * When the upstream SDK types improve, this adapter can be simplified or
 * removed without affecting the rest of the codebase.
 */

import type { PositronApi, RuntimeVariable, QueryTableSummaryResult } from "@posit-dev/positron";
import type { ExecutionObserver } from "./types";

// ─── Session types (underspecified in @posit-dev/positron SDK) ───

export interface SessionMetadata {
  sessionId: string;
  languageId: string;
  runtimeName: string;
  runtimeId: string;
}

export interface RuntimeSession {
  metadata: SessionMetadata;
}

// ─── Execute code options ───────────────────────────────────────

export interface ExecuteCodeOptions {
  /** Target language ID ("python", "r", etc.) */
  languageId: string;
  /** Code to execute */
  code: string;
  /** Whether to focus the console */
  focus: boolean;
  /** Allow incomplete statements */
  allowIncomplete: boolean;
  /** Optional target session ID */
  sessionId?: string;
  /** Observer for execution lifecycle events */
  observer: ExecutionObserver;
}

// ─── Connection driver options ──────────────────────────────────

export interface ConnectionInput {
  id: string;
  label: string;
  type: "string" | "number" | "boolean";
  value: string;
}

export interface ConnectionDriverOptions {
  driverId: string;
  languageId?: string;
  inputs?: ConnectionInput[];
}

// ─── Environment variable types ─────────────────────────────────

/** VS Code EnvironmentVariableMutatorType enum values */
export const EnvMutatorType = {
  Replace: 1,
  Append: 2,
  Prepend: 3,
} as const;

export type EnvMutatorTypeValue = (typeof EnvMutatorType)[keyof typeof EnvMutatorType];

export interface EnvironmentVariableAction {
  action: EnvMutatorTypeValue;
  name: string;
  value: string;
}

/** Keyed by extension ID, each extension contributes an array of actions */
export type EnvironmentContributions = Record<string, EnvironmentVariableAction[]>;

// ─── Editor context ─────────────────────────────────────────────

export interface EditorContextResult {
  document?: {
    path: string;
    languageId: string;
  };
  selection?: unknown;
}

// ─── Plot settings ──────────────────────────────────────────────

export interface PlotSettings {
  size: { width: number; height: number };
  [key: string]: unknown;
}

// ─── Runtime info ───────────────────────────────────────────────

export interface RuntimeInfo {
  runtimeName: string;
  runtimeId: string;
  languageId: string;
}

// ─── Console width listener ─────────────────────────────────────

export type ConsoleWidthListener = (width: number) => void;

// ─── Adapter ─────────────────────────────────────────────────────

/**
 * Typed adapter wrapping PositronApi with proper interfaces for all
 * runtime methods whose types are incomplete in the SDK.
 */
export class PositronAdapter {
  constructor(private readonly api: PositronApi) {}

  /** Returns the underlying PositronApi for direct access if needed. */
  getApi(): PositronApi {
    return this.api;
  }

  // ── Session helpers ──────────────────────────────────────────

  /** Extract SessionMetadata from a runtime session object. */
  static getSessionMetadata(session: unknown): SessionMetadata {
    const meta = (session as { metadata?: Record<string, unknown> }).metadata ?? {};
    return {
      sessionId: String(meta.sessionId ?? ""),
      languageId: String(meta.languageId ?? ""),
      runtimeName: String(meta.runtimeName ?? ""),
      runtimeId: String(meta.runtimeId ?? ""),
    };
  }

  /** Extract sessionId from a runtime session object. */
  static getSessionId(session: unknown): string {
    return PositronAdapter.getSessionMetadata(session).sessionId;
  }

  /** Extract languageId from a runtime session object. */
  static getSessionLanguageId(session: unknown): string {
    return PositronAdapter.getSessionMetadata(session).languageId;
  }

  // ── Runtime operations ───────────────────────────────────────

  /** Get all active runtime sessions. */
  async getActiveSessions(): Promise<unknown[]> {
    return this.api.runtime.getActiveSessions();
  }

  /** Get the foreground session, or undefined if none. */
  async getForegroundSession(): Promise<unknown | undefined> {
    return this.api.runtime.getForegroundSession();
  }

  /**
   * Execute code in a runtime session.
   * The SDK type signature is incomplete; we cast through a well-defined
   * local interface for safety.
   */
  async executeCode(options: ExecuteCodeOptions): Promise<unknown> {
    // The runtime accepts focus + allowIncomplete + sessionId + observer
    // beyond what the SDK types declare. Cast through unknown to provide
    // the full options object.
    type ExecuteCodeFn = (
      languageId: string,
      code: string,
      focus: boolean,
      allowIncomplete: boolean,
      sessionId: string | undefined,
      observer: ExecutionObserver,
    ) => Promise<unknown>;

    const fn = this.api.runtime.executeCode as unknown as ExecuteCodeFn;
    return fn(
      options.languageId,
      options.code,
      options.focus,
      options.allowIncomplete,
      options.sessionId,
      options.observer,
    );
  }

  /** Get the preferred runtime for a language. */
  async getPreferredRuntime(languageId: string): Promise<RuntimeInfo> {
    const runtime = await this.api.runtime.getPreferredRuntime(languageId);
    const rt = runtime as { runtimeName?: string; runtimeId?: string };
    return {
      runtimeName: rt.runtimeName ?? "",
      runtimeId: rt.runtimeId ?? "",
      languageId,
    };
  }

  /**
   * Get all variables defined in a session (flattened 1-D list).
   *
   * Although @posit-dev/positron@0.2.4's d.ts declares this as a 2-D array
   * (bucketed by access-keys), the runtime currently flattens when no
   * access-keys are provided. We rely on the runtime contract rather than
   * the SDK type to stay forward-compatible.
   */
  async getSessionVariables(sessionId: string): Promise<Array<unknown>> {
    type GetVarsFn = (sessionId: string) => Promise<Array<unknown>>;
    const fn = (this.api as unknown as { runtime: { getSessionVariables: GetVarsFn } })
      .runtime.getSessionVariables;
    return fn(sessionId);
  }

  /**
   * Inspect variables with optional access-key selection.
   * Uses the Positron runtime extension API; returns a 2-D array bucketed by
   * the access-keys argument (the same shape Positron Assistant sees).
   */
  async inspectVariables(
    sessionId: string,
    accessKeys?: Array<Array<string>>,
  ): Promise<Array<Array<RuntimeVariable>>> {
    type GetVarsFn = (
      sessionId: string,
      accessKeys?: Array<Array<string>>,
    ) => Promise<Array<Array<RuntimeVariable>>>;
    const fn = (this.api as unknown as { runtime: { getSessionVariables: GetVarsFn } })
      .runtime.getSessionVariables;
    return fn(sessionId, accessKeys);
  }

  /**
   * Query summary statistics for tabular variables (data frames, matrices, etc.).
   * Mirrors the Positron Assistant `getTableSummary` tool.
   */
  async queryTableSummaries(
    sessionId: string,
    accessKeys: Array<Array<string>>,
    queryTypes: Array<string>,
  ): Promise<Array<QueryTableSummaryResult>> {
    type QueryFn = (
      sessionId: string,
      accessKeys: Array<Array<string>>,
      queryTypes: Array<string>,
    ) => Promise<Array<QueryTableSummaryResult>>;
    const fn = (this.api as unknown as { runtime: { querySessionTables: QueryFn } })
      .runtime.querySessionTables;
    return fn(sessionId, accessKeys, queryTypes);
  }

  // ── AI features (Positron Assistant parity) ──────────────────────

  /**
   * Get the data URI of the currently selected Positron plot.
   * Returns the URI in `data:<mime>;base64,...` form, or undefined if no plot
   * is visible. Mirrors the Positron Assistant `getPlot` tool.
   */
  async getCurrentPlotUri(): Promise<string | undefined> {
    const ai = (this.api as unknown as { ai?: { getCurrentPlotUri?: () => Promise<string | undefined> } })
      .ai;
    if (!ai?.getCurrentPlotUri) {
      throw new Error(
        "Positron API does not expose ai.getCurrentPlotUri() in this version.",
      );
    }
    return ai.getCurrentPlotUri();
  }

  // ── Window operations ────────────────────────────────────────

  /** Open a URL in the Positron Viewer pane. */
  async previewUrl(url: string): Promise<void> {
    // The SDK type expects a Uri, but the runtime accepts a string.
    type PreviewUrlFn = (url: string) => Promise<void>;
    const fn = this.api.window.previewUrl as unknown as PreviewUrlFn;
    return fn(url);
  }

  /** Get plot rendering settings. */
  async getPlotsRenderSettings(): Promise<PlotSettings> {
    return this.api.window.getPlotsRenderSettings() as unknown as Promise<PlotSettings>;
  }

  /** Register a listener for console width changes. */
  onDidChangeConsoleWidth(listener: ConsoleWidthListener): { dispose(): void } | undefined {
    // onDidChangeConsoleWidth is available at runtime but not in SDK types
    type OnWidthFn = (listener: ConsoleWidthListener) => { dispose(): void };
    const fn = (this.api.window as unknown as { onDidChangeConsoleWidth?: OnWidthFn })
      .onDidChangeConsoleWidth;
    return fn?.(listener);
  }

  // ── Connections ──────────────────────────────────────────────

  /** Register a connection driver. */
  async registerConnectionDriver(options: ConnectionDriverOptions): Promise<void> {
    type RegisterFn = (options: ConnectionDriverOptions) => Promise<void>;
    const fn = this.api.connections
      .registerConnectionDriver as unknown as RegisterFn;
    return fn(options);
  }

  // ── Editor context ───────────────────────────────────────────

  /** Get the last active editor context. */
  async lastActiveEditorContext(): Promise<EditorContextResult | undefined> {
    const ctx = await this.api.methods.lastActiveEditorContext();
    if (!ctx) return undefined;
    return ctx as unknown as EditorContextResult;
  }

  // ── Environment ──────────────────────────────────────────────

  /** Get the mutable environment contributions map. */
  async getEnvironmentContributions(): Promise<EnvironmentContributions> {
    return this.api.environment.getEnvironmentContributions() as Promise<EnvironmentContributions>;
  }
}
