# TradingView Dual MCP Server Setup for QUANTFLOW

You now have **two TradingView MCP servers** running in parallel for maximum flexibility:

## Server Overview

### 1. **tradingview-analysis** (Python)
**Automated Analysis & Market Data**

```
Location:  /Library/Frameworks/Python.framework/Versions/3.13
Module:    tradingview_mcp (atilaahmettaner)
Tools:     30+ market analysis tools
Use Case:  Automated scanning, backtesting, sentiment analysis
```

**Best for:**
- ✅ Live price quotes (stocks, crypto, commodities)
- ✅ Technical analysis (20+ indicators)
- ✅ Strategy backtesting
- ✅ Market screening & filtering
- ✅ Reddit sentiment analysis
- ✅ Market news & sentiment
- ✅ No external dependencies (works anywhere)

**Example commands:**
```bash
# Ask Claude directly:
"Get the current price of XAUUSD"
"Run technical analysis on BTCUSD"
"What are the top gainers on KUCOIN?"
"Backtest the RSI strategy on SPY"
"Get market sentiment for Tesla"
```

---

### 2. **tradingview-interactive** (Node.js)
**Chart Control & Pine Script Development**

```
Location:  /Users/achraf/tradingview-mcp-jackson
Module:    tradingview-mcp-jackson (LewisWJackson)
Tools:     81 MCP tools + CLI
Use Case:  Interactive chart work, Pine Script, practice trading
```

**Best for:**
- ✅ Chart navigation & control
- ✅ Pine Script development & debugging
- ✅ Replay mode (practice trading with P&L)
- ✅ Drawing on charts (trend lines, levels)
- ✅ Morning brief workflow
- ✅ Multi-pane layouts
- ✅ Indicator management
- ✅ Custom indicator data reading

**Requires:**
- TradingView Desktop app running
- Chrome DevTools Protocol enabled on port 9222
- Node.js

**Example commands:**
```bash
# Ask Claude directly:
"Run my morning brief"
"Switch to BTCUSD on 4H"
"Write a Pine Script for RSI divergence"
"Set up a 2x2 chart grid"
"Start replay at March 1st"
"Draw a support level at 70,000"

# Or use CLI:
tv brief              # Morning brief
tv symbol BTCUSD      # Change symbol
tv pine compile       # Compile Pine Script
tv pane layout 2x2    # Multi-pane setup
tv stream quote       # Monitor price in real-time
```

---

## Launch Scripts

### Start Both Servers
```bash
cd ~/CascadeProjects/QUANTFLOW\ V1
./scripts/launch_dual_tv_mcp.sh
```

Output:
```
✅ Analysis Server (PID: 26837)
   • Real-time prices, indicators, backtesting
   • Ready immediately

✅ Interactive Server (PID: 26842)
   • Chart control, Pine Script, replay
   • Requires TradingView Desktop with port 9222
```

### Health Check
```bash
./scripts/launch_dual_tv_mcp.sh --check
```

### View Status
```bash
./scripts/launch_dual_tv_mcp.sh --status
```

### Stop All Servers
```bash
./scripts/launch_dual_tv_mcp.sh --stop
```

### View Live Logs
```bash
# Analysis server
tail -f ~/CascadeProjects/QUANTFLOW\ V1/logs/tradingview_analysis_*.log

# Interactive server
tail -f ~/CascadeProjects/QUANTFLOW\ V1/logs/tradingview_interactive_*.log
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼────────┐
│   Analysis     │   │   Interactive   │
│   (Python)     │   │   (Node.js)     │
└───────┬────────┘   └────────┬────────┘
        │                     │
        │          ┌──────────┘
        │          │
   ┌────▼──────────▼────────┐
   │   Yahoo Finance API    │
   │   Crypto Exchanges     │
   │   Reddit / News Feeds  │
   │ TradingView Desktop    │
   │ (CDP on port 9222)     │
   └────────────────────────┘
```

---

## Configuration Files

### Claude Desktop Config
```json
~/.claude/claude_desktop_config.json

{
  "mcpServers": {
    "tradingview-analysis": {
      "command": "/path/to/python3",
      "args": ["-m", "tradingview_mcp.server"]
    },
    "tradingview-interactive": {
      "command": "node",
      "args": ["/path/to/tradingview-mcp-jackson/src/server.js"]
    }
  }
}
```

### Jackson Rules Configuration
```json
~/tradingview-mcp-jackson/rules.json

{
  "watchlist": ["BTCUSDT", "EURUSD", "AAPL"],
  "strategy": { /* your strategy */ },
  "bias_criteria": { /* your bias rules */ },
  "entry_rules": { /* your entry rules */ },
  "risk_rules": [ /* your risk management */ ]
}
```

---

## Quick Start Examples

### Example 1: Morning Brief Workflow
```bash
# 1. Start both servers
./scripts/launch_dual_tv_mcp.sh

# 2. From Claude Code, ask:
# "Run morning_brief and give me my session bias"

# Expected output:
# BTCUSD  | BIAS: Bearish  | KEY LEVEL: 71,000  | WATCH: RSI < 40
# EURUSD  | BIAS: Neutral  | KEY LEVEL: 1.173   | WATCH: Ribbon direction
# AAPL    | BIAS: Bullish  | KEY LEVEL: 260.5   | WATCH: Hold above 20 EMA

# 3. Save the brief
# Ask Claude: "save this brief"

# 4. Next morning, compare
# Ask Claude: "get yesterday's session"
```

### Example 2: Automated Market Scanning
```bash
# Ask Claude:
# "Scan KUCOIN for coins with RSI < 30 and volume > 2x average"

# Uses: market_screener + smart_volume_scanner
# Returns: 5-10 coins matching criteria with prices
```

### Example 3: Pine Script Development
```bash
# Ask Claude:
# "Write a Pine Script that alerts when RSI divergence occurs on daily"

# Claude will:
# 1. Write the script (pine_set_source)
# 2. Compile it (pine_smart_compile)
# 3. Show errors if any (pine_get_errors)
# 4. Inject into TradingView (pine_set_source)
# 5. Save it (pine_save)
```

### Example 4: Strategy Backtesting
```bash
# Ask Claude:
# "Backtest the RSI strategy on BTC-USD over 1 year"

# Returns:
# Total Return: +125.3%
# Win Rate: 62%
# Sharpe Ratio: 1.8
# Max Drawdown: -15%
# Best Trade: +8.2%
# Worst Trade: -2.1%
```

---

## Troubleshooting

### Analysis Server Not Starting
```bash
# Check Python installation
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 --version

# Verify module installed
python3 -m pip list | grep tradingview

# Reinstall if needed
python3 -m pip install --upgrade tradingview-mcp-server
```

### Interactive Server Not Starting
```bash
# Check Node.js installed
node --version

# Install dependencies
cd ~/tradingview-mcp-jackson
npm install

# Check TradingView is running with Chrome DevTools Protocol
# Mac: ./scripts/launch_tv_debug_mac.sh
```

### Both Servers Started But Claude Doesn't See Tools
```bash
# Restart Claude Code/Desktop
# The MCP servers are loaded at startup

# Verify config is correct
cat ~/.claude/claude_desktop_config.json

# Check both servers are running
./scripts/launch_dual_tv_mcp.sh --status
```

### Port 9222 Already in Use
```bash
# Another TradingView instance is using the port
# Close other instances or:
lsof -i :9222
kill -9 <PID>
```

---

## Performance & Resource Usage

| Metric | Analysis | Interactive |
|--------|----------|-------------|
| Startup Time | 1-2 seconds | 2-3 seconds |
| Memory (idle) | ~50MB | ~80MB |
| Memory (active) | ~100MB | ~150MB |
| CPU (idle) | <1% | <1% |
| CPU (scanning) | 5-10% | N/A |
| Network | Yahoo Finance API | Chrome DevTools |
| Requires Chart | No | Yes |

---

## Advanced: Running Servers Separately

### Just Analysis (for automated scripts)
```bash
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 -m tradingview_mcp.server
```

### Just Interactive (for manual trading)
```bash
cd ~/tradingview-mcp-jackson
node src/server.js
```

### Using the CLI
```bash
# Install globally (one time)
cd ~/tradingview-mcp-jackson
npm link

# Use tv command anywhere
tv brief              # Morning brief
tv symbol BTCUSD      # Change symbol
tv pine compile       # Compile Pine Script
tv --help             # All commands
```

---

## Next Steps

1. **Test the Analysis Server**
   ```bash
   Ask Claude: "Get the current price of BTC"
   ```

2. **Configure TradingView for Interactive Mode**
   - Open TradingView Desktop
   - Run: `./scripts/launch_tv_debug_mac.sh`
   - Keep it running while using interactive tools

3. **Set Up Your Trading Rules**
   - Edit: `~/tradingview-mcp-jackson/rules.json`
   - Define your watchlist, bias criteria, entry/exit rules

4. **Run Your First Morning Brief**
   ```bash
   Ask Claude: "Run morning_brief"
   ```

5. **Build Your Automated Workflow**
   - Schedule: `tv brief` via cron
   - Monitor: price alerts, sentiment
   - Execute: trades via Claude commands

---

## Support & Documentation

- **Analysis Server:** https://github.com/atilaahmettaner/tradingview-mcp
- **Interactive Server:** https://github.com/LewisWJackson/tradingview-mcp-jackson
- **Claude MCP Docs:** https://modelcontextprotocol.io/

---

**Status:** ✅ Both servers configured and ready to use!
