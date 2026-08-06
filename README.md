# Positron Console MCP

A fork of [davidrsch/positron-console-mcp](https://github.com/davidrsch/positron-console-mcp) v1.0.4.
Published as `zeiss.positron-console-mcp`.

## What this fork adds

Three new MCP tools that mirror Positron Assistant's built-in
`getPlot` / `inspectVariables` / `getTableSummary` tools, so any MCP
client (Claude Code, Oh-My-Pi, Cursor, …) can drive the Positron
Variables panel and Plots pane through the same surface that the
in-IDE Assistant uses.

| Tool | Positron API used | What it returns |
|---|---|---|
| `get_plot` | `positron.ai.getCurrentPlotUri()` | `{ plot: { mimeType, dataUri } }` or `{ plot: null }` |
| `inspect_variables` | `positron.runtime.getSessionVariables(sessionId, accessKeys?)` | Rich per-variable metadata (display name, type, size, has_children, …) bucketed by access keys |
| `get_table_summary` | `positron.runtime.querySessionTables(sessionId, accessKeys, queryTypes)` | `column_schemas`, `column_profiles`, `num_rows`, `num_columns` for tabular variables |

The full 12 original tools (`execute_code`, `list_consoles`, `get_active_console`, `focus_console`, `get_session_variables`, `get_preferred_runtime`, `create_connection`, `get_console_width`, `set_environment_variable`, `get_editor_context`, `open_viewer`, `get_plot_settings`) are unchanged.

## What else changed

- **Bundled SDK** — `@posit-dev/positron@^0.2.4` is now inline-bundled
  by esbuild (the original repo kept it as a runtime `require`; this
  fork removes the `node_modules` requirement so the packaged `.vsix`
  is self-contained).
- **Stable default port** — `positronConsoleMcp.port` defaults to
  `45589` instead of `0`. The default `0` made the OS assign a new
  port on every Positron reload, which broke any client config that
  hard-coded a URL.
- **No keyboard focus stealing** — `execute_code` passes `focus: false`
  (`positron-console-mcp`'s `executeCode` and Positron's Assistant use the
  same API contract). **Caveat:** on Positron 2026.07+, producing console
  output still swaps the active tab in a shared Console/Plots container to
  the Console panel — this is [Positron bug #13394](https://github.com/posit-dev/positron/issues/13394)
  (client-side, open), not this extension. Keyboard focus is preserved;
  only the visible tab flips. Any `executeCode` caller (including Positron's
  own Assistant) is affected.
- **`showStatus` / `restart` rewritten** — they write a multi-line
  diagnostic to a dedicated `Positron Console MCP` output channel and
  show a one-line toast with an action button. The original used
  embedded `\n` in `showInformationMessage` (renders poorly) and an
  `await` on the toast that blocked `restart` indefinitely until the
  user dismissed it.
- **Publisher** — `davidrsch` → `zeiss` so the fork doesn't track the
  upstream OpenVSX feed (no spurious upgrade prompts).

## Install

1. Uninstall any pre-existing `davidrsch.positron-console-mcp` from
   the Positron / VS Code Extensions panel.
2. Download `positron-console-mcp-1.0.0.vsix` from the
   [Releases](../../releases) page.
3. In Positron: `Cmd+Shift+P` → **Extensions: Install from VSIX…** →
   pick the downloaded `.vsix`.
4. Reload Window.

Then point your MCP client at `http://localhost:45589/mcp`.

## Building from source

```bash
npm install
npm run build       # dev build (with sourcemap)
npm run package     # produces positron-console-mcp-1.0.0.vsix
```

`npm run package` requires `--no-dependencies` is implicit in the
`package` script; the SDK is bundled so `node_modules` does not need
to be shipped.

## Configuration

| Setting | Default | Notes |
|---|---|---|
| `positronConsoleMcp.port` | `45589` | Set to `0` for OS-assigned port on each reload. Update your MCP client URL to match. |

## Known caveats

- `@posit-dev/positron@0.2.4` declares `runtime.getSessionVariables`
  as a 2-D array (bucketed by access-keys), but the Positron runtime
  currently flattens to 1-D when no `accessKeys` are passed. The
  adapter casts explicitly to keep behaviour stable. If the runtime
  is later updated to honour the typed shape, the `get_session_variables`
  tool will start returning 2-D structures.

## License

MIT (see `LICENSE.txt`).

## Upstream

Forked from <https://github.com/davidrsch/positron-console-mcp>
under MIT. Full attribution in `LICENSE.txt`.
