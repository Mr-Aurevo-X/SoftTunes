# SoftTunes 1.7.0 — simplification (utile, pas théâtre)

**Product display name:** SoftTunes · **Repo:** `Mr-Aurevo-X/SoftTunes` · binary build: `Opti.exe`

## Highlights

- **5 main nav entries:** Accueil · Session · Caches · FPS · Historique
- **Expert mode:** Réseau · NVIDIA (if GPU) · Fond Windows
- **Honesty layer:** launch modal, in-app copy, README disclaimer — no FPS promise
- **Readiness pills** replace 0–100 score ring and delta theatre
- **Session page** merges Power, Game Mode, Visual, Overlays
- **`applySessionPreset`** with RP opt-in (off by default)
- **Contextual ? help** replaces Conseils nav page

## Removed from UI (API kept for undo)

Timer/Prio/MMCS · Debloat · TCP gaming tweaks · score breakdown · separate profile nav

## Install

- Portable: `SoftTunes.zip` on [this repo's Releases](https://github.com/Mr-Aurevo-X/SoftTunes/releases)
- Install: `%LOCALAPPDATA%\Programs\SoftTunes` · data: `%LOCALAPPDATA%\SoftTunes`
- Dev: `Lancer.cmd` in this repo

## Commit

`6f82bd8` — feat: SoftTunes 1.7 UI simplification
