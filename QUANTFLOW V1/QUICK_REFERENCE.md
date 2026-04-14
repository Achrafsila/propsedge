# ⚡ QUANTFLOW V1 - Guide Rapide des Branches

## 🚀 Commandes Essentielles

### Voir toutes les branches
```bash
git branch -v
# ou avec le script fourni:
./show_branches.sh
```

### Se déplacer vers une branche
```bash
# Développement principal
git checkout develop

# Une feature phase
git checkout feature/phase1-signal-collection

# Un skill spécifique
git checkout skill/liquidity-mapper

# Documentation
git checkout docs/architecture
```

### Créer une branche locale depuis une branche distante
```bash
git checkout -t origin/skill/liquidity-mapper
# ou plus simplement si le nom est unique:
git checkout skill/liquidity-mapper
```

---

## 📝 Scénarios Courants

### 📌 Scénario 1: Développer une nouvelle feature

```bash
# 1. Partir de develop (à jour)
git checkout develop
git pull origin develop

# 2. Créer votre branche de travail
git checkout -b feature/ma-nouvelle-feature

# 3. Développer...
vim src/mon_fichier.py

# 4. Commiter vos changements
git add src/mon_fichier.py
git commit -m "feat: description claire du changement"

# 5. Push vers remote
git push -u origin feature/ma-nouvelle-feature

# 6. Créer une PR sur GitHub
# (depuis GitHub: créer PR vers develop)

# 7. Après approbation et merge
git checkout develop
git pull origin develop
```

### 🎯 Scénario 2: Travailler sur un skill

```bash
# Exemple: Améliorer Liquidity Mapper

git checkout skill/liquidity-mapper
git pull origin skill/liquidity-mapper

# Modifier le code du skill
vim src/liquidity_analyzer.py

# Ajouter/modifier les tests
vim tests/test_liquidity_mapper.py

# Commiter
git add src/liquidity_analyzer.py tests/test_liquidity_mapper.py
git commit -m "feat: improve liquidity mapper accuracy"

# Push et PR
git push origin skill/liquidity-mapper
# PR vers develop
```

### 🐛 Scénario 3: Fixer un bug urgent en production

```bash
# 1. Créer un hotfix depuis main
git checkout main
git pull origin main
git checkout -b hotfix/bug-urgent

# 2. Fixer le bug
vim src/fichier_probleme.py

# 3. Commiter
git commit -m "fix: resolve critical issue"

# 4. Push et créer PR
git push -u origin hotfix/bug-urgent

# 5. PR vers main PUIS vers develop
# (Créer 2 PRs pour s'assurer que develop reçoit aussi le fix)
```

### 📚 Scénario 4: Documenter l'architecture

```bash
git checkout docs/architecture
git pull origin docs/architecture

# Ajouter documentation
vim docs/architecture/system_architecture.md

# Commiter
git commit -m "docs: update architecture documentation"

git push origin docs/architecture
# PR vers develop
```

### 🔬 Scénario 5: Expérimenter une nouvelle approche

```bash
# Commencer sur develop
git checkout develop
git pull

# Créer branche expérimental
git checkout -b experiment/nouvelle-approche

# Tester des idées sans pression...
# Si succès: créer feature branche appropriée
# Si échec: abandonner ou garder pour référence
```

---

## 🔍 Vérifier l'État des Branches

### Voir les changements par rapport à develop
```bash
git diff develop..feature/ma-feature
```

### Voir les commits pas encore mergés
```bash
git log develop..feature/ma-feature --oneline
```

### Voir quelle branche a quel commit
```bash
git branch -v --contains abc1234
```

### Voir les branches mergées
```bash
git branch --merged develop
```

### Voir les branches NON mergées
```bash
git branch --no-merged develop
```

---

## 🧹 Nettoyage des Branches

### Supprimer une branche locale
```bash
git branch -d feature/ma-feature
# Force delete (même si pas mergé):
git branch -D feature/ma-feature
```

### Supprimer une branche distante
```bash
git push origin --delete feature/ma-feature
```

### Supprimer toutes les branches locales mergées
```bash
git branch --merged | grep -v '^\*\|main\|develop' | xargs git branch -d
```

---

## 📊 Comparaison de Branches

### Voir les fichiers différents
```bash
git diff --name-only develop..feature/phase1-signal-collection
```

### Compter les changements
```bash
git diff --stat develop..feature/phase1-signal-collection
```

### Voir les commits manquants
```bash
# Commits dans feature mais pas dans develop:
git log develop..feature/ma-feature --oneline

# Commits dans develop mais pas dans feature:
git log feature/ma-feature..develop --oneline
```

---

## 🔀 Merging & Rebasing

### Merger une branche dans une autre
```bash
git checkout develop
git pull origin develop
git merge feature/ma-feature
```

### Rebaser une feature sur develop
```bash
git checkout feature/ma-feature
git rebase develop

# En cas de conflit:
# 1. Résoudre les conflits
# 2. git add .
# 3. git rebase --continue
```

### Squash commits avant merge
```bash
git rebase -i develop
# Marquer les commits à squash avec 's'
```

---

## 📈 Workflow Typique pour une PR

```bash
# 1. Mettre à jour local
git fetch origin
git checkout develop
git pull origin develop

# 2. Créer feature branche
git checkout -b feature/ma-feature

# 3. Développer (plusieurs commits)
git add src/fichier1.py
git commit -m "feat: part 1"

git add src/fichier2.py
git commit -m "feat: part 2"

# 4. Avant de pusher, rebaser sur develop
git fetch origin
git rebase origin/develop

# 5. Pusher
git push -u origin feature/ma-feature

# 6. Créer PR sur GitHub
# - Title: "feat: clear description"
# - Description: détails + context
# - Link issues si applicable

# 7. Après approbation
git checkout develop
git pull origin develop
# Merge via GitHub UI

# 8. Nettoyer
git branch -d feature/ma-feature
```

---

## ⚠️ Pièges à Éviter

### ❌ NE PAS: Commiter directement sur main
```bash
# ❌ MAUVAIS
git checkout main
git add .
git commit -m "quick fix"

# ✅ BON
git checkout -b hotfix/issue
git add .
git commit -m "fix: description"
# Puis PR
```

### ❌ NE PAS: Merger sans tests
```bash
# ❌ MAUVAIS
git merge feature/ma-feature

# ✅ BON
# S'assurer que tests passent AVANT merge
pytest
git merge feature/ma-feature
```

### ❌ NE PAS: Force push sur main ou develop
```bash
# ❌ DANGEREUX
git push -f origin develop

# ✅ BON (si vraiment nécessaire)
git push -f-with-lease origin feature/ma-feature
```

### ❌ NE PAS: Mélanger plusieurs features dans une PR
```bash
# ❌ MAUVAIS
# feature branche contenant feature A + feature B

# ✅ BON
# Une branche = une feature logique unique
```

### ❌ NE PAS: Négliger les commits de merge
```bash
# ❌ MAUVAIS (commits de merge inutiles)
git pull (implicite merge)

# ✅ BON
git fetch
git rebase origin/develop
```

---

## 🎓 Bonnes Pratiques Git

### Messages de commit clairs
```bash
# ✅ BON
git commit -m "feat: add liquidity mapper skill

- Implement cluster detection algorithm
- Add support for SL/TP grouping
- Includes unit tests"

# ❌ MAUVAIS
git commit -m "updates"
git commit -m "fix stuff"
```

### Commits logiques et atomiques
```bash
# ✅ BON: Chaque commit = une change logique
commit 1: "feat: add liquidity mapper class"
commit 2: "feat: implement clustering algorithm"
commit 3: "test: add unit tests for mapper"

# ❌ MAUVAIS: Tout dans un commit
commit 1: "feat: add mapper, update docs, fix other stuff"
```

### Branch à jour avant merge
```bash
git fetch origin
git rebase origin/develop
git push origin feature/ma-feature
# Puis merger via UI
```

---

## 📱 Alias Utiles

Ajoutez à `.git/config` ou `.gitconfig`:

```bash
# Branches colorées et lisibles
git config --global alias.br 'branch -v'

# Log court et lisible
git config --global alias.lg 'log --oneline --graph --all'

# Status court
git config --global alias.st 'status -sb'

# Diff fusionné
git config --global alias.df 'diff'

# Branches non mergées
git config --global alias.nmb 'branch --no-merged'

# Supprimer branches mergées
git config --global alias.cleanup 'branch --merged | grep -v "\*" | xargs -n 1 git branch -d'
```

Usage:
```bash
git br        # voir branches
git lg        # voir log
git st        # voir status
git cleanup   # nettoyer branches
```

---

## 🚨 Récupération d'Erreurs

### "J'ai commité sur la mauvaise branche!"
```bash
# 1. Créer nouvelle branche avec les commits
git branch feature/correction

# 2. Réinitialiser la mauvaise branche
git reset --hard HEAD~1

# 3. Aller sur la bonne branche
git checkout feature/correction
```

### "J'ai mergé accidentellement!"
```bash
git reset --hard HEAD~1
# OU
git revert HEAD
```

### "Où sont mes commits?"
```bash
git reflog
# Chercher le commit hash
git checkout abc1234
# Puis créer une branche depuis là
git branch sauvetage
```

---

## 📋 Checklist Avant PR

- [ ] Code compilé et sans erreurs
- [ ] Tests passent: `pytest`
- [ ] Pas de console.log/print() inutiles
- [ ] Pas de credentials/secrets
- [ ] Branch à jour avec develop: `git rebase develop`
- [ ] Commits bien nommés et atomiques
- [ ] Documentation mise à jour si nécessaire
- [ ] PR description claire et détaillée

---

## 🆘 Obtenir de l'Aide

```bash
# Aide générale Git
git help

# Aide pour une commande
git help commit
git help branch

# Aide interactive
man git-commit
```

---

**Dernier update**: 2026-04-14
**Version**: 1.0 ✅
