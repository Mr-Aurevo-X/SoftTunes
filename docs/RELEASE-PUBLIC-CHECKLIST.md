# Opti — release publique (checklist)

SoT : `Opti/` · version cible **1.6.0** · canal actuel : **privé** (Install-Easy / PCCommand-Releases).

## Bloquants techniques

- [x] `Lancer.cmd` → `host\opti_host.py`
- [x] `opti_setup.py` : `VERSION` 1.6.0 · dossier `%LOCALAPPDATA%\Programs\OptiBy-Mr-Aurevo-X`
- [x] UI : clés i18n `navGroupHistory`, `navGroupLegal` · toggle FR/EN sidebar
- [x] Miroir stale `builds/Opti/` retiré (README → SoT `Opti/`)

## UX / contenu public

- [x] Sections avancées : libellés plain-language + badge « Mode avancé — experts »
- [x] Overlay FPS : préréglages Minimal / Standard / Complet
- [x] Preset « Optimiser pour jouer » : liste d’actions + confirmation
- [x] Nav FR harmonisée (Énergie, Mode jeu, etc.)

## Distribution & légal

- [ ] `Lancer.cmd` testé depuis PC Command + standalone
- [ ] Install-Easy v1.4.7+ : chemin Opti.zip OK
- [ ] SmartScreen / absence de signature — documenté dans About
- [ ] Build `Opti.exe` fraîche si ship releases

## Décision produit (manuelle)

- [ ] **Rester privé** (Install-Easy uniquement)
- [ ] **Repo public** + profil `/workshop/opti`

**Verdict actuel : prêt pour review interne** — pas de ship public automatique tant que la décision ci-dessus n’est pas validée.

## Tests smoke

1. `Lancer.cmd` sans exe → fenêtre Opti
2. Toggle FR/EN · preset confirm · overlay presets
3. Mode avancé : Monitor FPS + soft perf lisibles
4. Install-Easy : extraction + raccourci
