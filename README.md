# Opti

Optimiseur PC gaming **indépendant**, **100 % gratuit**, **version finale complète** (v1.4.1).

Éditeur : Mr-Aurevo-X (copyright). Opti **n’appartient pas** à la suite d’outils Mr-Aurevo-X / Launcher.

- Traitement 100 % local — aucune collecte
- Pas de mise à jour automatique in-app
- Install : `OptiSetup.exe` → `%LOCALAPPDATA%\Programs\Opti\`
- Mode Avancé : **Power Limit / Soft**, **Soft OC** (clocks NVIDIA bornés), **Monitor FPS** (PresentMon intégré, sans RTSS) + **overlay HUD** léger (toujours visible, clic traversant)

## Emplacement (Dev Central Tree)

| Chemin | Rôle |
|--------|------|
| **`Dev Central Tree\Opti\`** (ce dépôt) | Clone Git de [Mr-Aurevo-X/Opti](https://github.com/Mr-Aurevo-X/Opti) — **source of truth** pour éditer, build, commit/push |
| **`Dev Central Tree\builds\Opti\`** | Distribution / setup (`OptiSetup.exe`, copies runtime) |

Opti n’est **pas** un outil Suite. Le Launcher et les scripts de release l’excluent du catalogue hub.

## Lancer

- Installateur : `OptiSetup.exe` (ou sous `..\builds\Opti\`)
- Portable (onedir) : `Opti-dist\Opti.exe` — le dossier `_internal` doit rester à côté de l’exe (ne pas déplacer l’exe seul).
- Dev : `Opti.exe` à la racine de ce repo après build

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

Les modifications se font ici (`Dev Central Tree\Opti`), puis `git push` vers https://github.com/Mr-Aurevo-X/Opti (sauvegarde). L’app installée chez l’utilisateur ne se met pas à jour seule.
