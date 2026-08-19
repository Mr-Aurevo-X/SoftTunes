# Opti

Optimiseur PC gaming **indépendant**, **100 % gratuit**, **version finale complète** (v1.6.0).

Éditeur : Mr-Aurevo-X (copyright). Opti **n’appartient pas** à la suite d’outils Mr-Aurevo-X / PC Command.

- Traitement 100 % local — aucune collecte
- Pas de mise à jour automatique in-app
- Install / mises à jour : **Install-Easy** → `Opti.zip` sur `Mr-Aurevo-X/PCCommand-Releases`
- Mode Avancé : **Power Limit / Soft**, **Soft OC** (clocks NVIDIA bornés), **Monitor FPS** (PresentMon intégré, sans RTSS) + **overlay HUD** léger (toujours visible, clic traversant)

## Emplacement (Dev Central Tree)

| Chemin | Rôle |
|--------|------|
| **`Dev Central Tree\Opti\`** (ce dépôt) | Clone Git de [Mr-Aurevo-X/Opti](https://github.com/Mr-Aurevo-X/Opti) — **source of truth** pour éditer, build, commit/push |
| **`Dev Central Tree\builds\Opti\`** | Distribution / setup (`OptiSetup.exe`, copies runtime) |

Opti n’est **pas** un outil Suite. Le canal Releases `PCCommand-Releases` le livre en pack `Opti.zip` (Install-Easy).

## Lancer

- Install-Easy : pack Opti → `%LOCALAPPDATA%\OptiBy-Mr-Aurevo-X`
- Portable (onedir) : `Opti-dist\Opti.exe` — le dossier `_internal` doit rester à côté de l’exe (ne pas déplacer l’exe seul).
- Dev : `Lancer.cmd` à la racine de ce repo

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

Les modifications se font ici (`Dev Central Tree\Opti`), puis `git push` vers https://github.com/Mr-Aurevo-X/Opti. Les mises à jour utilisateur passent par **Install-Easy** / `Opti.zip` sur **PCCommand-Releases** (pas d’auto-update in-app).

## Soutien

Coups de pouce volontaires (Opti reste gratuit) :

[![PayPal](https://img.shields.io/badge/PayPal-Donate-39ff14?style=for-the-badge&logo=paypal&logoColor=00f0ff&labelColor=050807)](https://www.paypal.com/paypalme/aurevo1)
[![Revolut](https://img.shields.io/badge/Revolut-mr__aurevo__x-00f0ff?style=for-the-badge&logo=revolut&logoColor=39ff14&labelColor=050807)](https://revolut.me/mr_aurevo_x)
