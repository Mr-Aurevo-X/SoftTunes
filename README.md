# Opti

Optimiseur PC gaming **indépendant**, **100 % gratuit**, **version finale complète** (v1.4.1).

Éditeur : Mr-Aurevo-X (copyright). Opti **n’appartient pas** à la suite d’outils Mr-Aurevo-X / Launcher.

- Traitement 100 % local — aucune collecte
- Pas de mise à jour automatique in-app
- Install : `OptiSetup.exe` → `%LOCALAPPDATA%\Programs\Opti\`
- Mode Avancé : **Power Limit / Soft**, **Soft OC** (clocks NVIDIA bornés), **Monitor FPS** (PresentMon intégré, sans RTSS) + **overlay HUD** léger (toujours visible, clic traversant)

## Emplacement Suite (Opti vs Opti-src-temp)

Sous `Suite Mr-Aurevo-X\` :

| Dossier | Rôle |
|---------|------|
| **`Opti-src-temp\`** (ce dépôt) | Clone Git de [Mr-Aurevo-X/Opti](https://github.com/Mr-Aurevo-X/Opti) — **source of truth** pour éditer, build, commit/push |
| **`Opti\`** | Copie **runtime** orpheline (souvent juste `Opti.exe` + assets) pour lancement local — **ne pas** y committer ; ne pas la supprimer si vous utilisez encore cet exe |

Le Launcher masque les deux (`excludeDirs` / `hiddenApps`). Les scripts de release (`MrAurevoX-Releases`) les excluent aussi. Après un build réussi depuis ce repo, vous pouvez recopier l’exe vers `..\Opti\Opti.exe` si besoin, sans toucher au layout runtime existant.

## Lancer

- Installateur : `OptiSetup.exe`
- Portable (onedir) : `Opti-dist\Opti.exe` — le dossier `_internal` doit rester à côté de l’exe (ne pas déplacer l’exe seul).
- Suite runtime : `..\Opti\Opti.exe` (copie locale, hors Git)

Dev :

```powershell
cd <repo>   # Opti-src-temp sous la Suite
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

Les modifications se font ici (`Opti-src-temp`), puis `git push` vers https://github.com/Mr-Aurevo-X/Opti (sauvegarde). L’app installée chez l’utilisateur ne se met pas à jour seule.
