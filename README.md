[Français](README.md) · [English](README.en.md)

# SoftTunes

Préparation de session Windows **indépendante** et **gratuite** (v1.7.0, nom produit **SoftTunes**). Ce n’est **pas** un « booster FPS +500 ».

## Important

> **SoftTunes ne promet aucun gain de FPS.** Ce n’est pas un « booster +500 FPS ». L’app prépare Windows pour une session (plan d’alimentation, Game Mode, bureau allégé, overlays) et **mesure** le FPS via PresentMon. Toute variation de frames dépend du jeu, du matériel et de vos réglages in-game.

| Fait | Ne fait pas |
|------|-------------|
| Plan perf, Game Mode, visuel bureau | Garantir +XXX FPS |
| Fermer overlays (opt-in) | Remplacer GPU / undervolt sérieux |
| Mesurer FPS / frametime | Téléchargement auto de mises à jour |
| Undo / sessions | Optimiser les graphismes in-game |

Éditeur : Mr-Aurevo-X (copyright). SoftTunes **n’appartient pas** à la suite PC Command.

> Dépôt GitHub et binaire : toujours `Opti` / `Opti.exe` pour l’instant (renommage technique plus tard).

- Prépare Windows pour une **session de jeu** (plan d’alimentation, Game Mode, overlays Xbox, caches)
- Mesure le FPS réel via **PresentMon** (overlay HUD) — sans garantir un gain de frames
- Soft OC **NVIDIA uniquement** → verrous horloge bornés (pas d’undervolt)
- 100 % local — aucune collecte
- Si une release GitHub est plus récente : notification in-app + bouton vers la page (pas de téléchargement auto)

## Emplacement (Dev Central Tree)

| Chemin | Rôle |
|--------|------|
| **`Dev Central Tree\03_Standalones\Opti\`** (ce dépôt) | Clone Git de [Mr-Aurevo-X/Opti](https://github.com/Mr-Aurevo-X/Opti) — **source of truth** pour éditer, build, commit/push |
| **`Dev Central Tree\builds\Opti\`** | Distribution / setup (`OptiSetup.exe`, copies runtime) |

Opti n’est **pas** un outil Suite. **Ship :** `Opti.zip` sur les [Releases de ce repo](https://github.com/Mr-Aurevo-X/Opti/releases). **Nom affiché : SoftTunes.**

## Lancer

- Portable : zip de release → extraire, garder `_internal` à côté de `Opti.exe`
- Dev : `Lancer.cmd` à la racine de ce repo
- Ancien chemin Install-Easy (`%LOCALAPPDATA%\OptiBy-Mr-Aurevo-X`) : obsolète — réinstaller depuis la release Opti

Windows peut afficher « potentiellement dangereux » : les binaires ne sont pas signés Authenticode (pas de certificat éditeur payant). C’est un avertissement de réputation SmartScreen, pas un verdict antivirus.

Dev :

```powershell
cd "C:\Users\aurel\Documents\Dev Central Tree\Opti"
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python host\opti_host.py
```

## Build

```bat
tools\build_opti.bat
tools\build_setup.bat
```

## Sync GitHub

Les mises à jour se prennent **manuellement** (clone GitHub ou zip de release). L’app peut afficher une notification si GitHub Latest est plus récent.

## Soutien

Coups de pouce volontaires (SoftTunes reste gratuit) :

[![Discord](https://img.shields.io/badge/Discord-Mr--Aurevo--X-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=050807)](https://discord.com/users/406891052516114442)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-39ff14?style=for-the-badge&logo=paypal&logoColor=00f0ff&labelColor=050807)](https://www.paypal.com/paypalme/aurevo1)
[![Revolut](https://img.shields.io/badge/Revolut-mr__aurevo__x-00f0ff?style=for-the-badge&logo=revolut&logoColor=39ff14&labelColor=050807)](https://revolut.me/mr_aurevo_x)

---

Rêvée par **Mr-Aurevo-X**. Cursor a réalisé le rêve.
