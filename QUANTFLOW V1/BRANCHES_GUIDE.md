# 🌳 QUANTFLOW V1 - Guide des Branches

## 📋 Stratégie de Branching

La structure des branches suit un modèle **Git Flow** adapté à QUANTFLOW V1, organisé par **phases** et **skills**.

---

## 🎯 Branches Principales

### `main`
- **Statut** : Production - Code stable et testé
- **Protection** : Fusion par PR uniquement
- **Quand** : Releases finales et déploiements en production

### `develop`
- **Statut** : Développement principal
- **Protection** : Fusion par PR
- **Quand** : Intégration de toutes les features/skills
- **Base** : Branche de base pour créer les features

### `staging`
- **Statut** : Pré-production
- **Protection** : Fusion depuis develop
- **Quand** : Tests finaux avant production
- **Durée** : ~1-2 jours de test

---

## 📦 Branches de Phases

Les trois phases du système QUANTFLOW:

### Phase 1: Signal Collection
```
feature/phase1-signal-collection
├── Telegram signal scraping
├── Google Sheets storage
└── Data normalization
```
- **Contient** : `src/telegram_listener.py`, `src/google_sheets_uploader.py`
- **Merge vers** : `develop`

### Phase 2: Market Context Integration
```
feature/phase2-market-context
├── TradingView live connector
├── Real-time OHLC data
└── Price synchronization
```
- **Contient** : `src/tradingview_live_price.py`, `src/price_synchronizer.py`
- **Dépend de** : Phase 1 ✅
- **Merge vers** : `develop`

### Phase 3: Institutional Liquidity Analysis
```
feature/phase3-institutional-analysis
├── Liquidity mapping
├── Stop hunt detection
├── Position analysis
└── SMC market structure
```
- **Contient** : `src/liquidity_analyzer.py`, `src/smc_analyzer.py`
- **Dépend de** : Phase 1 + Phase 2 ✅
- **Merge vers** : `develop`

---

## 🛠️ Branches de Skills

Chaque skill Cowork/Claude a sa propre branche:

### Skill 1: Liquidity Mapper
```
skill/liquidity-mapper
├── RetailPositioningAnalyzer
├── LiquidityMapper (clustering SL/TP)
└── Input: Trading signals | Output: Liquidity clusters
```

### Skill 2: Positioning Analyzer
```
skill/positioning-analyzer
├── Retail bias calculation
├── Position statistics
└── Input: Trading signals | Output: Positioning status
```

### Skill 3: Stop Hunt Detector
```
skill/stop-hunt-detector
├── Pattern detection
├── Sweep identification
└── Input: Liquidity clusters + Market data | Output: Events
```

### Skill 4: Price Fetcher
```
skill/price-fetcher
├── TradingView API wrapper
├── Live price + OHLC
└── Input: Symbol + Timeframe | Output: Market context
```

### Skill 5: SMC Structure Analyzer
```
skill/smc-structure-analyzer
├── Order blocks
├── Fair value gaps
└── Input: Market data | Output: SMC analysis
```

### Skill 6: Trading Setup Generator
```
skill/trading-setup-generator
├── Entry zone generation
├── SL/TP calculation
└── Input: Liquidity + Market structure | Output: Trade setup
```

### Skill 7: Report Formatter
```
skill/report-formatter
├── HTML/JSON formatting
├── Google Sheets export
└── Input: All analyses | Output: Formatted report
```

### Skill 8: Batch Processor
```
skill/batch-processor
├── Historical data processing
├── Dataset analysis
└── Input: Bulk signals | Output: Analysis results
```

---

## 📚 Branches de Documentation

### `docs/architecture`
- Architecture system complète
- Diagrammes et workflows
- Dépendances entre composants

### `docs/api-reference`
- Documentation API des skills
- Formats d'input/output
- Exemples d'utilisation

### `docs/setup-guide`
- Installation et configuration
- Guide de déploiement
- Troubleshooting

---

## 🐛 Branches de Bugfix

### `fix/test-suite`
- Tests unitaires
- Tests d'intégration
- CI/CD pipeline

**Merge vers** : `develop` + `main`

---

## 🔬 Branches Expérimentales

### `experiment/new-features`
- Features expérimentales
- Research et POC
- Tests de nouvelles approches
- **Ne jamais merger dans main sans validation**

---

## 🔄 Workflow Recommandé

### Pour une nouvelle feature/skill:

```bash
# 1. Créer une branche de travail depuis develop
git checkout develop
git pull origin develop
git checkout -b feature/ma-feature

# 2. Développer et commiter
git add .
git commit -m "feat: description du changement"

# 3. Push et créer une PR
git push origin feature/ma-feature
# Créer PR vers develop

# 4. Code review et merge
# Après approbation, merge dans develop

# 5. Tester en staging
git checkout staging
git pull origin develop
# Tests...

# 6. Merger vers main
git checkout main
git pull origin staging
# Puis release
```

### Pour un bugfix urgents:

```bash
git checkout main
git pull origin main
git checkout -b hotfix/mon-bug

# Fix et test
git push origin hotfix/mon-bug

# Merger en main ET develop
# PR vers main d'abord
# Puis PR vers develop
```

---

## 📊 Dépendances entre Branches

```
main (production)
  ↑
staging (tests finaux)
  ↑
develop (intégration)
  ├── feature/phase1-signal-collection
  ├── feature/phase2-market-context
  ├── feature/phase3-institutional-analysis
  └── skill/*
      ├── skill/liquidity-mapper
      ├── skill/positioning-analyzer
      ├── skill/stop-hunt-detector
      ├── skill/price-fetcher
      ├── skill/smc-structure-analyzer
      ├── skill/trading-setup-generator
      ├── skill/report-formatter
      └── skill/batch-processor

docs/* (indépendant)
experiment/* (indépendant)
fix/test-suite (sur main + develop)
```

---

## ✅ Checklist pour Merger

Avant de merger une branche:

- [ ] Code reviewed (minimum 1 approval)
- [ ] Tests passent localement (`pytest`)
- [ ] Pas de conflits avec la branche cible
- [ ] Commits bien nommés et logiques
- [ ] Documentation mise à jour si nécessaire
- [ ] Pas de credentials/keys commités
- [ ] Branch à jour avec la cible

---

## 🚀 Bonnes Pratiques

### Noms de commits
```
feat: Add liquidity mapper skill
fix: Resolve clustering issue
docs: Update architecture guide
test: Add unit tests for analyzer
refactor: Simplify price fetcher
```

### Taille des branches
- Branches courtes (< 1 semaine idéalement)
- Chaque feature = une branche unique
- Chaque skill = une branche unique

### Communication
- PR description détaillée
- Lier les issues pertinentes
- Mentionner les dépendances

---

## 🎓 Exemples Pratiques

### Développer le Liquidity Mapper:
```bash
git checkout develop
git pull
git checkout -b skill/liquidity-mapper

# Développer skill...
# Tests...

git push origin skill/liquidity-mapper
# PR vers develop
```

### Fixer un bug en production:
```bash
git checkout main
git pull
git checkout -b hotfix/signal-parsing

# Fix bug...
git push
# PR vers main ET develop
```

### Expérimenter une nouvelle approche:
```bash
git checkout develop
git pull
git checkout -b experiment/new-features

# Essayer nouvelles idées...
# SI succès → créer feature branche appropriée
# SINON → abandonner (ou garder pour référence)
```

---

## 📈 Métriques à Suivre

- Nombre de branches actives
- Temps moyen entre création et merge
- Nombre de PRs bloquées
- Test coverage par branche
- Branches stagnantes (> 2 semaines)

---

**Dernière mise à jour**: 2026-04-14
**Status**: ✅ Structure active
