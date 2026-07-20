# Opti

Optimiseur PC gaming **Mr-Aurevo-X** — performances, Game Mode, boost, caches GPU, réseau, profils par jeu.

100 % local. Aucune collecte. © 2026 Mr-Aurevo-X

## Installer (recommandé)

1. Téléchargez **`OptiSetup.exe`** (GitHub Release / suite)
2. Double-cliquez → installe dans `%LOCALAPPDATA%\Programs\Mr-Aurevo-X\Opti`
3. Raccourcis Bureau + Menu Démarrer

Ou lancez le dossier portable **`Opti-dist\Opti.exe`**.

### SmartScreen

Sans certificat Authenticode (payant), Windows peut afficher un avertissement :

**Informations complémentaires → Exécuter quand même**

Voir aussi *À propos* dans l’app et `tools/submit-defender.md`.

## Développement

```powershell
cd "C:\Users\aurel\Desktop\Suite Mr-Aurevo-X\Opti"
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python host\opti_host.py
```

## Build (anti-faux-positif)

```bat
tools\build_opti.bat
tools\build_setup.bat
```

- Packaging **onedir** (`--noupx`) + métadonnées éditeur Mr-Aurevo-X
- Pas de PyArmor / AES / onefile (profil AV plus propre)
- Protection légère : JS minifié soft au build ; sources git restent claires

## Architecture

- `host/opti_host.py` — pywebview
- `api/` + `modules/` — PowerShell
- `ui/` — interface + `legal/`
- `lists/` — politiques protect

## Licence / légal

CGU, ToS, RGPD et disclaimer dans l’app (**À propos**) et `ui/legal/`.
