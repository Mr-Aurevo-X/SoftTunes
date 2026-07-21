# Opti

Optimiseur PC gaming **indépendant**, **100 % gratuit**, **version finale complète** (v1.4.1).

Éditeur : Mr-Aurevo-X (copyright). Opti **n’appartient pas** à la suite d’outils Mr-Aurevo-X / Launcher.

- Traitement 100 % local — aucune collecte
- Pas de mise à jour automatique in-app
- Install : `OptiSetup.exe` → `%LOCALAPPDATA%\Programs\Opti\`
- Mode Avancé : **Power Limit / Soft**, **Soft OC** (clocks NVIDIA bornés), **Monitor FPS** (PresentMon intégré, sans RTSS) + **overlay HUD** léger (toujours visible, clic traversant)

## Lancer

- Installateur : `OptiSetup.exe`
- Portable (onedir) : `Opti-dist\Opti.exe` — le dossier `_internal` doit rester à côté de l’exe (ne pas déplacer l’exe seul).
- Clé USB / `E:\Mr-Aurevo-X Dev\Opti\` : `tools\sync_portable_e.bat` (Lancer.cmd + prérequis WebView2/VC++).

Dev :

```powershell
cd <repo>
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

Les modifications se font en local, puis `git push` vers https://github.com/Mr-Aurevo-X/Opti (sauvegarde). L’app installée chez l’utilisateur ne se met pas à jour seule.
