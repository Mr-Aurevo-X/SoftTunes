# UI proprietaire — PC Command design kit

Source of truth for the Mr-Aurevo-X / L'Atelier Windows visual system.

**Not** an npm/NuGet package: apps vendor a file copy (PyInstaller-friendly). Hub sync: `..\scripts\Sync-All-UiKit.ps1`. Migration checklist: `..\docs\migrate-ui-proprietaire.md`.

## Layout

| Path | Role |
|------|------|
| `tokens/` | CSS variables, theme schema, presets |
| `components/` | Shell, settings panel, craft, dashboard helpers |
| `fonts/` | Outfit + JetBrains Mono (local woff2) |
| `brand/` | PC Command icon (ico/png) |
| `scripts/sync-ui-kit.ps1` | Copy kit → `ui/vendor/pc-command-kit/` for PyInstaller |
| `scripts/patch-tool-chrome.ps1` | Strip Atelier hub branding from vendored `tool-chrome.js` (standalones) |

## Dev vs release

- **Dev:** apps resolve sibling `..\..\UI proprietaire\` (or env `PC_COMMAND_KIT`).
- **Release:** run `scripts/sync-ui-kit.ps1 -Target <app>\ui\vendor\pc-command-kit` then bundle via `datas`.

## Theme file

User overrides: `%APPDATA%\Mr-Aurevo-X\atelier-theme.json`  
Schema: `tokens/theme-schema.json`

## Presets

- `pc-command` (default) — cyber command center, accent `#e03545`
- `soft-glass` — softer panels, lower glow
- `neon-precision` — stronger cyan/amber telemetry accents
- `graphite-minimal` — flat graphite chrome, muted cyan, low glow
- `amber-ops` — warm ops desk, amber telemetry + brand red
