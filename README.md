# Opti

Optimiseur PC gaming **indépendant**, **100 % gratuit**, **version finale complète** (v1.2.1).

Éditeur : Mr-Aurevo-X (copyright). Opti **n’appartient pas** à la suite d’outils Mr-Aurevo-X / Launcher.

- Traitement 100 % local — aucune collecte
- Pas de mise à jour automatique in-app
- Install : `OptiSetup.exe` → `%LOCALAPPDATA%\Programs\Opti\`
- Mode Avancé **Perf soft** : anti-parking CPU + Power Limit NVIDIA soft (pas d’undervolt matériel)

## Lancer

- Installateur : `OptiSetup.exe`
- Portable (onedir) : `Opti-dist\Opti.exe` — le dossier `_internal` doit rester à côté de l’exe (ne pas déplacer l’exe seul).

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
