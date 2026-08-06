# Changelog

## [1.1.0] - 2026-08-06

### Fixed

- 🐛 **Positron 2026.07 API compatibility** — `execute_code` returned empty output and `languageId` was blank on Positron 2026.07.x:
  - Positron moved `languageId`/`runtimeName`/`runtimeId` from `session.metadata` onto `session.runtimeMetadata`; the adapter now reads both (preferring `runtimeMetadata`), so `list_consoles` / `get_active_console` report the correct language and runtime again.
  - `runtime.executeCode` gained `mode` and `errorBehavior` parameters before `observer`/`sessionId`; the adapter now passes the full 8-arg signature (`mode="interactive"`, `errorBehavior="continue"`) so `execute_code` output capture and `focus_console` work again.


## [1.0.0-fork] - 2026-07-25

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


## [1.0.4] - 2026-05-09

### Fixed

- 🔧 Default port changed from `6071` to `0` (OS-assigned random free port) — eliminates all `EADDRINUSE` port conflicts
- 💥 Explicit port now fails fast with descriptive error instead of silently retrying to a different port

### Changed

- 📖 README: fixed all command palette names (`Console MCP:` prefix), added Installation section with auto-registration, added Commands table
- 🧹 Removed fragile port auto-retry loop in favor of OS-assigned port-0 + fail-fast for explicit ports

## [1.0.3] - 2026-05-08

### Added

- 🖥️ MCP server auto-registration via `registerMcpServerDefinitionProvider` — appears under **Extensions → MCP SERVERS → Installed** with logo
- 🏷️ `mcpServerDefinitionProviders` contribution point in `package.json`
- 📥 Open VSX install badge in README

### Changed

- 📦 GitHub Releases now named `positron-console-mcp v*.*.*`
- 🔒 CORS restricted from `*` to localhost origins only
- 🔄 Version extracted into shared `src/version.ts` module — server and health endpoint now report correct version
- 🧹 Typed `PositronAdapter` eliminates all `as any` / `@typescript-eslint/no-explicit-any` casts in `console-service.ts`
- 📇 MCP server name aligned to `positron-console-mcp` across all files, commands, and tests
- 🗺️ Switch-case dispatch replaced with typed dispatch map — localized `ToolArgsMap` casts
- 🧪 87 tests across 4 suites, coverage: 93.7% stmts / 84.6% branches / 95.8% funcs

## [1.0.2] - 2026-05-08

### Fixed

- 🔧 GitHub Release workflow permissions added (`contents: write`) to allow attaching VSIX artifacts

## [1.0.1] - 2026-05-08

### Added

- 🎨 `"icon": "logo.png"` field in `package.json` so Open VSX displays the extension logo

## [1.0.0] - 2026-05-08

### Production Release

- 🎯 **1.0.0 release** — all core features stable, 87 tests passing, MCP protocol compliant
- 🧪 87 tests across 4 test suites (unit + HTTP integration)
- 🔒 Stateless Streamable HTTP mode with localhost-only binding
- ⚡ Port auto-retry on EADDRINUSE (base through +9)
- 🛡️ Rate limiting (120 req/min/IP) with automatic cleanup
- ⚠️ Oversized payload rejection (5 MB limit)
- 🔍 Zod-based input validation with discriminated unions per tool
- 📊 Enhanced observability: health endpoint, structured logging, status bar
- ⏱️ execute_code timeout via Promise.race, output truncation (500KB/entry, 200 entries max)

### Breaking Changes from 0.1.0

- None. All tools and interfaces remain backward-compatible.

## [0.1.0] - 2026-05-07

### Initial Release

- 🚀 MCP Streamable HTTP server with 12 tools for Positron Console automation
- 📋 Session management: `list_consoles`, `get_active_console`, `focus_console`
- ⚡ Code execution: `execute_code` with full observer lifecycle (onStarted → onOutput → onCompleted → onFinished)
- 📦 Structured output capture (MIME data maps)
- 🔍 Variable introspection: `get_session_variables`
- 🔗 Connection management: `create_connection`
- 🎨 Plot settings and console width tools
- 📝 Editor context integration
- 🌐 Viewer pane URL opening
- 🔧 Environment variable management
- 🛑 Graceful degradation in standard VS Code (no Positron API)
- 📊 Status bar item with server status and port info
- ⚙️ Commands: Console MCP: Show Status, Copy MCP Configuration, Add to .vscode/mcp.json, Restart Server
- 🔒 Localhost-only server with Host header validation
- 🧪 33 unit tests with full Positron API mocking
