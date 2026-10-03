# Security Policy — SoftTunes

## Scope (EN)

**SoftTunes** is a **local Windows** desktop app (pywebview / WebView2).  
There is **no** Mr-Aurevo-X backend and **no** telemetry / publisher analytics.

Outbound network (when it happens):
- **Optional** read-only GitHub **Latest release** check (opt-out in About → `checkGithubUpdates`)
- **Support links** (Discord / dons crypto) only when the user clicks
- No other automatic phone-home

SoftTunes prepares a Windows play session (power plan, Game Mode, overlays, bounded NVIDIA soft OC) and meters FPS via PresentMon. It does **not** promise FPS gains.

Official builds: only Releases on **https://github.com/Mr-Aurevo-X/SoftTunes** (`SoftTunes.zip`).  
Forks / modified copies are **not** covered by this policy.

## Périmètre (FR)

App **locale** Windows. Pas de serveur Mr-Aurevo-X, pas de télémétrie éditeur.

Sorties réseau possibles :
- vérif. version GitHub **désactivable** (À propos)
- dons / Discord **au clic**
- rien d’autre en arrière-plan

SoftTunes prépare une session Windows et mesure le FPS — **sans promesse** de gain de frames.

Builds officiels uniquement : Releases de ce dépôt. Les forks modifiés ne sont **pas** couverts.

## Threat model

**In scope:** issues in **this** repository’s code / official zip that could lead to unexpected network egress, path traversal, command injection, or privilege misuse **beyond** the intended session-prep UI.

**Out of scope:** malware already on the user’s machine, fake downloads from third parties, Windows / SmartScreen reputation on unsigned binaries, misuse of intentional admin / GPU / power features, undervolt or third-party overclock tools.

## Reporting / Signalement

Prefer a **private GitHub Security Advisory** on this repository.  
Do **not** open a public issue with exploit details.  
Préférez une **advisory privée** GitHub. Ne publiez pas de détails d’exploit en issue publique.

This repo is **read-only** for PRs / issues (`CONTRIBUTING.md`) — security reports go through advisories only.

## Hardening (high level)

- Destructive / system-changing actions use confirmation (ConfirmGate) where applicable
- Support / release URLs are allowlisted in code
- NVIDIA Soft OC uses **bounded** clock locks (not undervolt)
- Paths and process arguments are validated before use where applicable

## Dependencies

Review Dependabot / dependency alerts on this repo when enabled. No auto-install of updates in-app.
