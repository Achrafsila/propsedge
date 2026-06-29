# System Architecture

## High-Level Architecture

### System Components
1. **Data Collection Service**: Telegram API integration
2. **TradingView Real-Time Connector**: Live price & market data streaming
3. **Message Processing Engine**: Core signal processing logic
4. **Filtering Service**: Signal validation and classification
5. **Scoring Engine**: Quality assessment and risk analysis with market context
6. **Storage Layer**: Data persistence and retrieval (signals + price history)
7. **API Gateway**: External interface and communication
8. **Monitoring Service**: System health and performance tracking

## Component Architecture

### Data Collection Service
**Technology Stack:**
- Language: Python
- Framework: asyncio for concurrent processing
- API: Telegram Bot API
- Message Queue: Redis/RabbitMQ for buffering

**Responsibilities:**
- Connect to Telegram channels
- Ingest messages in real-time
- Handle rate limiting and retries
- Forward messages to processing queue

**Key Features:**
- Multi-channel support
- Connection health monitoring
- Automatic reconnection
- Message deduplication

### TradingView Real-Time Connector
**Technology Stack:**
- Language: Python
- Protocol: WebSocket for real-time streaming
- API: TradingView Data/MCP connector
- Time-Series Database: InfluxDB/TimescaleDB for OHLCV
- Cache: Redis for live price cache

**Responsibilities:**
- Establish WebSocket connection to TradingView
- Stream real-time price ticks (sub-second latency)
- Aggregate OHLCV across multiple timeframes (1m, 5m, 15m, 1h, 4h, Daily)
- Calculate technical indicators (EMA, RSI, MACD, Bollinger Bands, ATR)
- Detect price movements and anomalies
- Store historical price data with persistence

**Key Features:**
- Multi-symbol support (GOLD/XAUUSD + others)
- High-frequency tick recording (7-day retention)
- OHLCV aggregation with automatic indicator calculation
- Live price cache with Bid/Ask spreads
- Real-time event detection (support/resistance breaches, volume spikes, trend reversals)
- Automatic reconnection with data recovery
- Dual data persistence (hot cache + cold storage)

**Data Outputs:**
- Live price cache (current bid/ask/volume/change%)
- Tick-level historical data (7 days)
- OHLCV aggregated data (30 days detail → unlimited archives)
- Technical indicator updates (real-time per candle)
- Price events log (movement alerts, anomalies)

**Integration Points:**
- Feeds live market data to Scoring Engine
- Enriches signal validation with current market context
- Provides market context for Decision Rules Engine
- Updates real-time dashboard and Google Sheets

### Message Processing Engine
**Technology Stack:**
- Language: Python
- Framework: Custom processing pipeline
- NLP: spaCy for text processing
- Caching: Redis for frequent patterns

**Processing Pipeline:**
1. Text preprocessing and cleaning
2. Language detection and filtering
3. Pattern recognition and keyword matching
4. Component extraction and validation
5. Structured data generation

**Performance Considerations:**
- Parallel processing for multiple messages
- Caching for common patterns
- Memory-efficient processing
- Configurable processing rules

### Filtering Service
**Technology Stack:**
- Language: Python
- Rules Engine: Custom rule evaluation system
- Configuration: YAML-based rule definitions
- Logging: Structured logging for debugging

**Filtering Logic:**
- Boolean rule evaluation
- Threshold-based decisions
- Exception handling
- Quality scoring

**Extensibility:**
- Dynamic rule updates
- Custom filter plugins
- A/B testing framework
- Performance analytics

### Scoring Engine (Enhanced with Market Context)
**Technology Stack:**
- Language: Python
- Algorithms: Custom scoring algorithms with market integration
- Analytics: Pandas for data analysis
- Machine Learning: scikit-learn for future enhancements
- Real-Time Data: Integration with TradingView Connector

**Scoring Components:**
- Signal completeness analysis (extraction status, fields presence)
- Risk-reward calculation (adjusted by current volatility)
- Source reliability weighting
- **Market context evaluation (NEW)**:
  - Live price distance to entry
  - Current trend alignment (EMA structure)
  - Volatility normalization (ATR-based)
  - Support/Resistance proximity
  - Volume profile analysis
  - Entry viability score based on market conditions

**Decision Framework:**
- Multi-criteria decision making with real-time market weights
- Dynamic threshold adjustment based on volatility
- Confidence intervals enhanced by market data
- Recommendation engine with trader guidance
- Score adjustments: +/- points for market alignment/opposition

**Enhanced Outputs:**
- Base signal score (0-100)
- Market-adjusted final score
- Viability assessment (VIABLE/MARGINAL/RISKY)
- Trader recommendation (wait for entry/execute at market/avoid)
- Entry distance and optimal execution guidance

### Storage Layer (Enhanced for Real-Time Market Data)
**Technology Stack:**
- Database: PostgreSQL for structured data (signals, messages, events)
- Time-Series DB: TimescaleDB/InfluxDB for OHLCV and tick data
- Cache: Redis for live price cache and fast access
- Archive: S3 for long-term storage
- Search: Elasticsearch for message search

**Data Models:**
- Messages: Raw and processed Telegram messages
- Signals: Extracted trading signals with market context
- Sources: Channel information and metrics
- Analytics: Performance and usage data
- **Price Data (NEW)**:
  - Tick data: Raw price ticks with bid/ask/volume
  - OHLCV data: Aggregated candles (multiple timeframes)
  - Technical Indicators: EMA, RSI, MACD, Bollinger Bands, ATR
  - Price Events: Support/resistance breaches, volume spikes, trend reversals

**Storage Strategy:**
- **Hot data**: 
  - Recent signals and messages (7 days)
  - Live price cache (real-time)
  - Recent price ticks (1-7 days)
- **Warm data**: 
  - Historical signals (30 days)
  - OHLCV 1m-4h candles (30 days)
  - Channel performance metrics
- **Cold data**: 
  - Archived messages (1+ year)
  - Daily OHLCV candles (unlimited)
  - Archived price data (S3)
- **Backup**: Automated backup and recovery for all tiers

### API Gateway
**Technology Stack:**
- Framework: FastAPI or Flask
- Authentication: JWT tokens
- Documentation: OpenAPI/Swagger
- Rate Limiting: Redis-based limiting

**API Endpoints:**
- GET /signals: Retrieve processed signals
- GET /sources: Source information and status
- GET /analytics: Performance metrics
- POST /config: Update configuration

**Security Features:**
- API key authentication
- Request validation
- Rate limiting
- CORS configuration

### Monitoring Service
**Technology Stack:**
- Metrics: Prometheus for system metrics
- Logging: ELK stack for log analysis
- Dashboard: Grafana for visualization
- Alerting: AlertManager for notifications

**Monitoring Areas:**
- System performance and health
- Processing accuracy and speed
- Data quality metrics
- External API status

## Data Flow Architecture

### Real-time Processing Flow (Signal + Market Data)
```
┌─ Telegram → Collection Service → Message Queue
│
├─ TradingView → Real-Time Connector → Price Cache → Indicator Calculator
│
Processing Engine → Filter Service → Scoring Engine (enriched with market data) → Storage → API Gateway
                                            ↑
                                    (live price context)
```

### Detailed Signal Processing with Market Context
```
Signal Arrives (Telegram)
  ↓
Extract Parameters (Action, Instrument, Entry, SL, TP)
  ↓
Query TradingView Real-Time Connector:
  - Current price
  - Bid/Ask spread
  - Trend (EMA alignment)
  - Volatility (ATR)
  - Support/Resistance levels
  ↓
Enhanced Signal Validation:
  - Is entry price near current market price?
  - Is trend aligned with BUY/SELL direction?
  - Is volatility normal or extreme?
  ↓
Adjust Scoring:
  - Base score + market alignment adjustment
  - Final score with confidence intervals
  ↓
Generate Trader Recommendation:
  - ACCEPT: Ready to execute
  - REVIEW: Needs market timing confirmation
  - REJECT: Invalid or too risky
  ↓
Output to Storage + Real-Time Dashboard
```

### Batch Processing Flow
```
Archive → Batch Processor → Analytics Engine → Historical Backtest
                                    ↓
                            Price Correlation Analysis
                                    ↓
                         Signal Performance vs Market Moves
                                    ↓
                              Storage → Reporting → Dashboard
```

### Price Data Pipeline
```
TradingView WebSocket Stream
  ↓
Real-Time Connector (validates, filters)
  ↓
Live Price Cache (Redis)
  ├→ Instant access for signal validation
  └→ Feed to Indicator Calculator
  ↓
Tick-Level Storage (TimescaleDB)
  ├→ 7-day retention (detailed analysis)
  └→ Feed to OHLCV Aggregator
  ↓
OHLCV Multi-Timeframe Aggregation
  ├→ 1m candles → 5m → 15m → 1h → 4h → 1D
  ├→ Technical indicator calculation per candle
  └→ Store by timeframe (30 days detailed, unlimited archives)
  ↓
Event Detection & Logging
  ├→ Support/Resistance breaches
  ├→ Volume spikes
  ├→ Trend reversals
  └→ Alert generation
```

## Scalability Architecture

### Horizontal Scaling
- **Stateless Services**: All services designed as stateless
- **Load Balancing**: Nginx/HAProxy for traffic distribution
- **Container Orchestration**: Docker/Kubernetes deployment
- **Auto-scaling**: Based on CPU and memory usage

### Performance Optimization
- **Caching Strategy**: Multi-level caching (Redis, application cache)
- **Database Optimization**: Indexing, query optimization
- **Connection Pooling**: Efficient resource utilization
- **Async Processing**: Non-blocking I/O operations

### Resource Management
- **Memory Management**: Efficient memory usage patterns
- **CPU Optimization**: Multi-core utilization
- **Network Efficiency**: Connection reuse and pooling
- **Storage Optimization**: Data compression and archiving

## Security Architecture

### Application Security
- **Input Validation**: Comprehensive input sanitization
- **Output Encoding**: Prevent injection attacks
- **Authentication**: Secure API authentication
- **Authorization**: Role-based access control

### Data Security
- **Encryption**: Data at rest and in transit
- **Access Control**: Principle of least privilege
- **Audit Logging**: Comprehensive audit trails
- **Backup Security**: Encrypted backups

### Infrastructure Security
- **Network Security**: Firewalls and VPC isolation
- **Container Security**: Secure container configurations
- **Secrets Management**: Secure credential storage
- **Vulnerability Management**: Regular security scanning

## Real-Time Market Context Integration

### How Signal Processing Leverages Live Price Data

**Before (Static Signal Validation):**
```
Signal: "BUY GOLD at 2025.50 SL 2018.00 TP 2035.00"
Check: ✓ Has action ✓ Has instrument ✓ Has SL/TP
Score: 85 points
Decision: ACCEPT
Trader Info: None - execute if you like it
```

**After (Enhanced with Market Context):**
```
Signal: "BUY GOLD at 2025.50 SL 2018.00 TP 2035.00"
Live Market Data Retrieved from TradingView:
  - Current Price: 2024.75
  - Trend: Uptrend (EMA 20 > 50 > 200)
  - Volatility: 0.8% (normal, ATR = 12)
  - Support Below: 2023.00
  - Resistance Above: 2027.50
  
Enriched Validation:
  - Price distance: 0.75 below entry (0.03%)
  - Entry viability: ✓ EXCELLENT (within pullback zone)
  - Risk/Reward: Adjusted 1.5:1 ratio
  - Trend confirmation: ✓ Aligned
  
Score Adjustment:
  - Base score: 85 pts
  - Trend alignment bonus: +5 pts
  - Good entry distance: +3 pts
  - Final score: 93 pts

Decision: ACCEPT (HIGH confidence)
Trader Recommendation: 
  "Price is 0.75 below entry - optimal for pullback entry.
   Trend is strong uptrend. Execute at 2025.50 or market (2024.75)."
```

### Key Benefits of Integration

1. **Entry Validation**: Confirm entry prices match current market conditions
2. **Trend Confirmation**: Verify signal direction aligns with current trend
3. **Risk Adjustment**: Adjust stop-loss/take-profit based on current volatility
4. **Timing Guidance**: Tell traders when to execute (now vs. wait)
5. **Performance Tracking**: Compare signal prices to actual execution prices
6. **Opportunity Assessment**: Identify if signal is still valid when received

### Real-Time Dashboard Features

The system maintains a live dashboard showing:
- Current GOLD/XAUUSD price with 24h range
- Trend analysis (EMA alignment, momentum)
- Recent price movements (tick-by-tick or candle-by-candle)
- Active signals with market context
- Entry distance to current price
- Recommended actions based on current market

## Deployment Architecture

### Environment Strategy
- **Development**: Local development environment
- **Staging**: Production-like testing environment
- **Production**: High-availability production deployment
- **Disaster Recovery**: Backup and recovery procedures

### Infrastructure Components
- **Compute**: Cloud instances (AWS/Azure/GCP)
- **Storage**: Managed database and storage services
- **Networking**: VPC, load balancers, DNS
- **Monitoring**: Cloud monitoring and logging services

### Deployment Pipeline
- **Source Control**: Git-based version control
- **CI/CD**: Automated build and deployment
- **Testing**: Automated testing at multiple levels
- **Release Management**: Controlled release process

## Integration Architecture

### External Integrations
- **Telegram API**: Real-time message collection
- **TradingView (NEW)**: 
  - Real-time price streaming (WebSocket)
  - OHLCV data and historical candles
  - Technical indicator data
  - Multi-timeframe support (1m through Monthly)
  - Live Bid/Ask/Volume data
- **Market Data APIs**: Enhanced price validation and context with live data
- **Notification Services**: Alert and notification delivery
- **Analytics Platforms**: Business intelligence integration
- **Google Sheets**: Live signal export with real-time price updates

### Internal Integrations
- **Service Communication**: REST APIs and message queues
- **Data Synchronization**: Consistent data across services
- **Event Streaming**: Real-time event processing
- **Configuration Management**: Centralized configuration

## Technology Rationale

### Python Ecosystem
- **Rich Libraries**: Extensive NLP and data processing libraries
- **Community Support**: Large developer community
- **Performance**: Good balance of performance and productivity
- **Integration**: Excellent integration capabilities

### PostgreSQL
- **Reliability**: Proven reliability and performance
- **Features**: Advanced features like JSON support
- **Scalability**: Good scaling characteristics
- **Ecosystem**: Rich tooling and community support

### Redis
- **Performance**: In-memory performance
- **Flexibility**: Multiple data structures
- **Reliability**: Persistence and clustering options
- **Simplicity**: Easy to use and maintain

## Complete System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUANTFLOW V1 SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  EXTERNAL DATA SOURCES                                                       │
│  ├─ Telegram Channels ────────────────────────────────────────────┐          │
│  └─ TradingView API ──────────────────────────────────────────────┤          │
│                                                                    │          │
│  INPUT LAYER                                                       │          │
│  ├─ Telegram Collection Service (Telethon)                        │          │
│  │  └─ Multi-channel listener, rate limit handler, message queue  │          │
│  └─ TradingView Real-Time Connector (WebSocket/MCP)       ◄───────┘          │
│     ├─ Price tick stream (sub-second)                                        │
│     ├─ Live cache (current bid/ask/volume)                                   │
│     └─ Technical indicator calculator                                        │
│                                                                               │
│  PROCESSING LAYER                                                            │
│  ├─ Message Processing Engine                                               │
│  │  ├─ Text preprocessing & language detection                              │
│  │  ├─ Pattern recognition & component extraction                           │
│  │  └─ Structured data generation                                           │
│  │                                                                           │
│  ├─ Filtering Service                                                       │
│  │  ├─ Hard reject gates (6 conditions)                                      │
│  │  └─ Boolean rule evaluation                                              │
│  │                                                                           │
│  └─ Scoring Engine (Enhanced with Market Context)                           │
│     ├─ Signal completeness (25 pts)                                         │
│     ├─ Entry confidence (20 pts)                                            │
│     ├─ Structure score (20 pts)                                             │
│     ├─ Risk management (20 pts)                                             │
│     ├─ Risk-reward ratio (15 pts)                                           │
│     └─ MARKET CONTEXT ADJUSTMENTS (NEW):                                    │
│        ├─ Trend alignment bonus/penalty                                     │
│        ├─ Entry viability assessment                                        │
│        ├─ Volatility normalization                                          │
│        └─ Support/Resistance proximity analysis                             │
│                                                                               │
│  DECISION ENGINE                                                             │
│  └─ Decision Rules                                                          │
│     ├─ ACCEPT: VALID + SL + TP + 80+ pts + no hard rejects                 │
│     ├─ REVIEW: VALID 60-79 pts OR PARTIAL 60+ pts                          │
│     └─ REJECT: Hard reject OR score < 60 pts                               │
│                                                                               │
│  STORAGE LAYER                                                              │
│  ├─ PostgreSQL (Signals, Messages, Events)                                 │
│  ├─ TimescaleDB (OHLCV, Technical Indicators)                              │
│  ├─ Redis Cache (Live prices, hot data)                                    │
│  └─ S3 Archive (Historical data, cold storage)                             │
│                                                                               │
│  OUTPUT LAYER                                                               │
│  ├─ Google Sheets Integration (Real-time export)                           │
│  ├─ Real-Time Dashboard (Live market + signals)                            │
│  ├─ API Gateway (REST endpoints)                                           │
│  └─ Notification Service (Alerts & events)                                 │
│                                                                               │
│  MONITORING & ANALYTICS                                                     │
│  ├─ Prometheus (Metrics)                                                   │
│  ├─ ELK Stack (Logging)                                                    │
│  ├─ Grafana (Visualization)                                                │
│  └─ AlertManager (Notifications)                                           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary
1. **Signal Input**: Telegram messages → Collection Service → Processing Queue
2. **Price Input**: TradingView WebSocket → Real-Time Connector → Price Cache
3. **Processing**: Extract signal params + Query live market data → Validate → Score
4. **Enrichment**: Apply market context to scoring (trend, volatility, entry viability)
5. **Decision**: Apply Decision Rules → ACCEPT/REVIEW/REJECT
6. **Output**: Store in database → Export to Google Sheets → Update Dashboard
7. **History**: Store OHLCV candles (30 days hot, unlimited archives)

## Future Considerations

### Microservices Evolution
- **Service Decomposition**: Gradual microservices adoption
- **Event-Driven Architecture**: Move to event-driven patterns (Kafka for real-time streams)
- **API Evolution**: GraphQL for flexible queries
- **Service Mesh**: Advanced service communication (gRPC)

### AI/ML Integration
- **Machine Learning**: Advanced signal classification with price movements
- **Natural Language Processing**: Improved text understanding
- **Predictive Analytics**: Signal success prediction based on market conditions
- **Automated Optimization**: Self-improving system with feedback loops
- **Volatility Forecasting**: ML-based prediction of future market moves

### Market Integration Enhancements
- **Advanced Support/Resistance**: ML detection of key levels
- **Liquidity Analysis**: Monitor order book depth and spreads
- **Sentiment Analysis**: Combine Reddit/sentiment data with price action
- **Correlation Analysis**: Track price correlations with other assets
- **Backtesting Engine**: Validate signals against historical price data
