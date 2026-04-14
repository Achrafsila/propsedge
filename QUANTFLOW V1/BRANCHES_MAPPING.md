# 📂 Mapping Branches ↔️ Répertoires du Projet

## Vue d'ensemble

Ce document mappe chaque branche aux fichiers/répertoires qu'elle modifie.

---

## 🔗 Mapping Détaillé

### Phase 1: Signal Collection
```
feature/phase1-signal-collection
│
├── src/
│   ├── telegram_listener.py          [Écoute Telegram channels]
│   ├── google_sheets_uploader.py     [Stock données dans Sheets]
│   └── integrations/
│       └── improved_telegram_pipeline.py
│
├── data/
│   └── [JSON files de signaux collectés]
│
├── scripts/
│   ├── telegram/                     [Scripts Telegram]
│   └── data_processing/
│
├── Tests:
│   ├── tests/telegram_listener_test.py
│   └── test_telegram_live.py
│
└── Docs:
    └── CHANNEL_DISCOVERY_GUIDE.md
    └── AUTO_SUBSCRIPTION_QUICK_START.md
```

---

### Phase 2: Market Context
```
feature/phase2-market-context
│
├── src/
│   ├── tradingview_live_price.py     [Connecteur TradingView API]
│   ├── price_synchronizer.py         [Synchronise prix + signaux]
│   └── market_watcher.py             [Surveille marché en temps réel]
│
├── data/
│   ├── market_context/               [Données marché OHLC]
│   └── price_snapshots/
│
├── Tests:
│   ├── test_tradingview_live.py
│   └── test_live_trade.py
│
└── Docs:
    └── TRADINGVIEW_DUAL_SETUP.md
    └── claude_tradingview_integration.md
```

---

### Phase 3: Institutional Liquidity Analysis
```
feature/phase3-institutional-analysis
│
├── src/
│   ├── liquidity_analyzer.py         [Core liquidity analysis]
│   │   ├── RetailPositioningAnalyzer
│   │   ├── LiquidityMapper
│   │   └── PriceActionAnalyzer
│   │
│   ├── smc_analyzer.py               [Market structure analysis]
│   │   ├── OrderBlock detection
│   │   ├── Fair Value Gap analysis
│   │   └── Liquidity zone mapping
│   │
│   ├── trading_setup_engine.py       [Trade setup generation]
│   └── trading_idea_engine.py
│
├── analysis/                          [Résultats d'analyses]
│   ├── liquidity_maps/
│   ├── smc_analysis/
│   └── trade_setups/
│
├── Tests:
│   ├── test_real_pipeline.py
│   └── test_pipeline_last_24h.py
│
└── Docs:
    └── Analyses (dans analysis/)
```

---

## 🎯 Skills Mapping

### Skill 1: Liquidity Mapper
```
skill/liquidity-mapper
│
├── src/liquidity_analyzer.py
│   └── LiquidityMapper class
│       ├── Input: List[TradingSignal]
│       └── Output: LiquidityClusters JSON
│
├── skills/
│   └── liquidity-mapper/
│       ├── skill.md
│       └── test_cases.json
│
└── Tests:
    └── test_liquidity_mapper.py
```

### Skill 2: Positioning Analyzer
```
skill/positioning-analyzer
│
├── src/liquidity_analyzer.py
│   └── RetailPositioningAnalyzer class
│       ├── Input: List[TradingSignal]
│       └── Output: {bias, longs, shorts, stats}
│
├── skills/
│   └── positioning-analyzer/
│       └── [Skill definition]
│
└── Tests:
    └── test_positioning_analyzer.py
```

### Skill 3: Stop Hunt Detector
```
skill/stop-hunt-detector
│
├── src/liquidity_analyzer.py
│   └── PriceActionAnalyzer class
│       ├── detect_stop_hunts()
│       └── detect_liquidity_sweeps()
│
├── skills/
│   └── stop-hunt-detector/
│
└── Tests:
    └── test_stop_hunt_patterns.py
```

### Skill 4: Price Fetcher
```
skill/price-fetcher
│
├── src/tradingview_live_price.py
│   └── TradingViewConnector class
│       ├── get_current_price()
│       ├── get_ohlc()
│       └── get_intraday_movement()
│
├── skills/
│   └── price-fetcher/
│
└── Tests:
    └── test_price_fetcher.py
```

### Skill 5: SMC Structure Analyzer
```
skill/smc-structure-analyzer
│
├── src/smc_analyzer.py
│   ├── OrderBlockAnalyzer
│   ├── FairValueGapDetector
│   └── LiquidityZoneMapper
│
├── analysis/smc_analysis/
│
├── skills/
│   └── smc-structure-analyzer/
│
└── Tests:
    └── test_smc_analyzer.py
```

### Skill 6: Trading Setup Generator
```
skill/trading-setup-generator
│
├── src/trading_setup_engine.py
│   └── TradingSetupEngine class
│       ├── generate_entry_zones()
│       ├── calculate_sl()
│       └── calculate_tp()
│
├── analysis/trade_setups/
│
├── skills/
│   └── trading-setup-generator/
│
└── Tests:
    └── test_setup_generator.py
```

### Skill 7: Report Formatter
```
skill/report-formatter
│
├── src/report_formatter.py
│   ├── HTMLReportFormatter
│   ├── JSONReportFormatter
│   └── GoogleSheetsFormatter
│
├── skills/
│   └── report-formatter/
│
└── Tests:
    └── test_report_formatter.py
```

### Skill 8: Batch Processor
```
skill/batch-processor
│
├── src/batch_processor.py
│   ├── HistoricalDataProcessor
│   └── BulkAnalyzer
│
├── data/batch_results/
│
├── skills/
│   └── batch-processor/
│
└── Tests:
    └── test_batch_processor.py
```

---

## 📚 Documentation Branches

### docs/architecture
```
docs/architecture
│
├── docs/
│   ├── architecture/
│   │   ├── system_architecture.md
│   │   ├── data_flow.md
│   │   ├── component_diagram.md
│   │   └── integration_flow.md
│   └── technical/
│
└── INTEGRATION_GUIDE.md
```

### docs/api-reference
```
docs/api-reference
│
├── docs/
│   └── api/
│       ├── liquidity_analyzer_api.md
│       ├── smc_analyzer_api.md
│       ├── trading_setup_api.md
│       └── [skill APIs]
│
└── API_DOCUMENTATION.md
```

### docs/setup-guide
```
docs/setup-guide
│
├── docs/
│   └── setup/
│       ├── installation.md
│       ├── configuration.md
│       ├── environment.md
│       └── deployment.md
│
├── SETUP_REAL_DISCOVERY.md
├── LAUNCH_QUANTFLOW.md
├── WORKFLOW_USAGE.md
└── TEST_GUIDE.md
```

---

## 🧪 Testing Branches

### fix/test-suite
```
fix/test-suite
│
├── tests/
│   ├── unit/
│   │   ├── test_liquidity_analyzer.py
│   │   ├── test_smc_analyzer.py
│   │   └── test_trading_setup.py
│   │
│   ├── integration/
│   │   ├── test_full_pipeline.py
│   │   ├── test_signal_to_analysis.py
│   │   └── test_market_sync.py
│   │
│   └── e2e/
│       └── test_full_workflow.py
│
├── .github/
│   └── workflows/
│       ├── tests.yml
│       ├── lint.yml
│       └── coverage.yml
│
└── pytest.ini
```

---

## 🔬 Experimental Branches

### experiment/new-features
```
experiment/new-features
│
├── src/experimental/
│   ├── advanced_clustering.py
│   ├── ml_position_predictor.py
│   ├── pattern_recognition.py
│   └── sentiment_analysis.py
│
├── notebooks/
│   └── research.ipynb
│
└── experiments/
    └── [Résultats expérimentaux]
```

---

## 📊 Fichiers Partagés (Toutes les branches)

```
.
├── README.md                          [Documentation générale]
├── requirements.txt                   [Dépendances Python]
├── .gitignore                         [Git ignore]
├── BRANCHES_GUIDE.md                  [Ce guide]
├── BRANCHES_MAPPING.md                [Mapping branches]
│
├── .env.example                       [Variables d'environnement]
├── credentials.json.example           [Credentials template]
│
├── logs/                              [Logs partagés]
├── data/                              [Data warehouse partagé]
├── analysis/                          [Analyses partagées]
└── sessions/                          [Session files]
```

---

## 🔄 Flux de Fichiers par Branche

### Flux: Signal Collection → Analysis → Output

```
feature/phase1-signal-collection
    ↓ (raw signals)
data/signals.json
    ↓ (consume)
feature/phase2-market-context
    ↓ (raw + market context)
data/enriched_signals.json
    ↓ (consume)
feature/phase3-institutional-analysis
    ↓ (analysis results)
analysis/
├── liquidity_maps/
├── smc_analysis/
├── trade_setups/
└── reports/
    ↓ (consume)
skill/report-formatter
    ↓ (formatted output)
output/
├── html_reports/
├── json_results/
└── google_sheets/
```

---

## 📋 Checklist de Modification par Type

### Si vous modifiez des Signals:
```
- [ ] feature/phase1-signal-collection
- [ ] Update: data/signals/ structure
- [ ] Update: tests/test_telegram_listener.py
- [ ] Notify: feature/phase2-market-context
```

### Si vous modifiez l'Analysis:
```
- [ ] feature/phase3-institutional-analysis
- [ ] Update: analysis/ results
- [ ] Update: src/liquidity_analyzer.py ou src/smc_analyzer.py
- [ ] Update: related tests
- [ ] Notify: skill/* branches
```

### Si vous ajoutez un Skill:
```
- [ ] skill/[new-skill]
- [ ] skills/[new-skill]/
- [ ] Update: BRANCHES_GUIDE.md
- [ ] Add tests in tests/
- [ ] Update: BRANCHES_MAPPING.md
```

---

**Dernière mise à jour**: 2026-04-14
**Statut**: ✅ Actif et à jour
