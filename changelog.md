## 1.0.0

Forked from davidrsch/positron-console-mcp v1.0.4. Major changes:

### New MCP tools (Positron Assistant parity)
- `get_plot` — return the data URI of the currently selected Positron plot,
  via `positron.ai.getCurrentPlotUri()`. Mirrors Positron Assistant's
  built-in `getPlot` tool. Returns `{ plot: { mimeType, dataUri } }` or
  `{ plot: null }` when no plot is visible.
- `inspect_variables` — return runtime variables via the Positron Variables
  panel extension API (`positron.runtime.getSessionVariables(sessionId,
  accessKeys?)`), with rich per-variable metadata (`display_name`,
  `display_type`, `kind`, `length`, `size`, `has_children`, ...).
  Mirrors Positron Assistant's `inspectVariables`.
- `get_table_summary` — query summary statistics for tabular variables
  via `positron.runtime.querySessionTables(sessionId, accessKeys,
  queryTypes)`, returning `column_schemas`, `column_profiles`,
  `num_rows`, `num_columns`. Mirrors Positron Assistant's `getTableSummary`.

### SDK upgrade
- `@posit-dev/positron`: `^0.1.6` → `^0.2.4`. Required to access
  `runtime.querySessionTables` and to keep the SDK in sync with the
  Positron host API. The SDK is now **bundled into `out/extension.js`**
  (esbuild `external` list reduced to just `vscode`), so the packaged
  vsix works without `node_modules`.

### Stability / UX fixes
- **Stable port**: default `positronConsoleMcp.port` is now `45589`
  instead of `0`. Default `0` made the OS assign a fresh port on every
  Positron reload, breaking consumer-side `.omp/agent/mcp.json` URLs.
  Set to `0` for the old behaviour.
- `execute_code` no longer steals focus (`focus: false`). Previously
  every code execution pushed the Console panel to the foreground,
  disrupting chat/editor focus.
- `showStatus` rewritten: now writes a multi-line diagnostic to a
  dedicated `Positron Console MCP` output channel and shows a single-line
  toast with an **Open Output** action button. Previous implementation
  relied on `\n` in `showInformationMessage`, which renders poorly.
- `restart` rewritten to be non-blocking: the dismissable info toast is
  fire-and-forget instead of awaited (awaiting it stalled the restart
  until the user dismissed the toast).
- Startup error path uses fire-and-forget error toast with a
  **Show Details** action button.

### Packaging / metadata
- `package.json` publisher: `davidrsch` → `zeiss`. This detaches the
  fork from the upstream OpenVSX feed, stopping spurious upgrade
  prompts. The published artifact identity is therefore
  `zeiss.positron-console-mcp` (not `davidrsch.*`).
- `engines.vscode` bumped to `^1.100.0` to match `@types/vscode`.
- `repository` / `bugs` / `homepage` updated to the fork URL.

### Known limitations / caveats
- `@posit-dev/positron@0.2.4` declares `runtime.getSessionVariables`
  as 2-D (bucketed by access-keys) in its `.d.ts`, but the runtime
  currently flattens to 1-D when no `accessKeys` are passed. The
  adapter casts explicitly to keep behaviour stable; if the runtime
  is later updated to honour the typed shape, the `get_session_variables`
  tool will start returning 2-D structures and would need a follow-up
  update.
