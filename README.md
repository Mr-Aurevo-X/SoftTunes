# Opti

Optimiseur PC gaming Mr-Aurevo-X — power, Game Mode, boost session, caches GPU, réseau, visuel, services, démarrage, debloat, timer/priorités, profils par jeu, undo + point de restauration.

100 % local. Aucune collecte de données.

## Lancer

```powershell
cd "C:\Users\aurel\Desktop\Suite Mr-Aurevo-X\Opti"
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python host\opti_host.py
```

Ou double-clic `Lancer.cmd` (préfère `Opti.exe` s’il existe).

Raccourci Desktop : `Opti Mr-Aurevo-X\Lancer Opti.cmd` → pointe vers ce dépôt Suite.

## Build

```bat
tools\build_opti.bat
```

Produit `Opti.exe` à la racine (UI loose `ui\` préférée à côté de l’exe).

## Architecture

- `host/opti_host.py` — pywebview + pont JSON
- `api/Invoke-OptiApi.ps1` — actions
- `modules\` — PowerShell
- `lists\` — protect / overlays / services / bloat
- `ui\` — HTML/CSS/JS brandé suite

## Sécurité

- Listes `protect-services.txt` / `keep-apps.txt` / `startup-safe.txt`
- Tweaks agressifs (timer, TCP) = opt-in
- Undo sous `%LOCALAPPDATA%\Mr-Aurevo-X\Opti\undo\`
- Point de restauration avant preset groupé
