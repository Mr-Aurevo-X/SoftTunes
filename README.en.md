[Français](README.md) · [English](README.en.md)

# SoftTunes

Independent **Windows session prep + FPS meter**, **100% free** (v1.7.0, product name **SoftTunes**). Not a “+500 FPS booster”.

## Important

> **SoftTunes does not promise any FPS gain.** It is not a « +500 FPS booster ». It prepares Windows for a session (power plan, Game Mode, lighter desktop, overlays) and **meters** FPS via PresentMon. Frame rates depend on your game, hardware, and in-game settings.

| Does | Does not |
|------|----------|
| Perf power plan, Game Mode, desktop effects | Guarantee +XXX FPS |
| Close overlays (opt-in) | Replace GPU / serious undervolt |
| Meter FPS / frametime | Auto-download updates |
| Undo / sessions | Tune in-game graphics |

Publisher: Mr-Aurevo-X. SoftTunes is **not** part of the PC Command hub catalog.

> GitHub repo: **`Mr-Aurevo-X/SoftTunes`**. Build binary still `Opti.exe` for now (exe rename later).

- Prepares Windows for a play session (power plan, Game Mode, Xbox overlays, caches)
- Meters real FPS via **PresentMon** (HUD overlay) — does not promise extra frames
- NVIDIA-only clock locks (bounded, not undervolt)
- Local processing — no publisher collection
- Newer GitHub release: in-app notice + browser button (no auto-download)

Read-only public distribution: no PRs or issues (`CONTRIBUTING.md`). License: PolyForm Noncommercial 1.0.0.

## Where it installs

| Mode | Location |
|------|----------|
| **Installer** (`OptiSetup.exe` / setup) | `%LOCALAPPDATA%\Programs\SoftTunes` — binary + `_internal` |
| **Portable** (`SoftTunes.zip`) | Folder **of your choice**: extract the zip, keep `_internal` next to the exe |
| **Data** (sessions, undo, settings) | `%LOCALAPPDATA%\SoftTunes` |
| **Dev (sources)** | Clone under `03_Standalones\Opti\` + `Lancer.cmd` |

Legacy paths `%LOCALAPPDATA%\Programs\Opti`, `OptiBy-Mr-Aurevo-X`, `%LOCALAPPDATA%\Opti` are still detected on first launch (data migrates to SoftTunes if needed).

Download: [SoftTunes Releases](https://github.com/Mr-Aurevo-X/SoftTunes/releases).

## Run

```bat
Lancer.cmd
```

Windows may flag the app as potentially unsafe: binaries are not Authenticode-signed (no paid publisher certificate). That is a SmartScreen reputation warning, not an antivirus verdict.

---

Dreamed by **Mr-Aurevo-X**. Cursor made the dream real.

[Discord](https://discord.com/users/406891052516114442) · [PayPal](https://www.paypal.com/paypalme/aurevo1) · [Revolut](https://revolut.me/mr_aurevo_x)
