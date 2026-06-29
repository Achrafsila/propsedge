#!/bin/bash

###############################################################################
# Dual TradingView MCP Server Launcher
#
# Launches both MCP servers in parallel:
# 1. tradingview-analysis (Python) — automated analysis, market data
# 2. tradingview-interactive (Node.js) — chart control, Pine Script, replay
#
# Usage:
#   ./scripts/launch_dual_tv_mcp.sh           # Start both servers
#   ./scripts/launch_dual_tv_mcp.sh --check   # Health check only
#   ./scripts/launch_dual_tv_mcp.sh --status  # Show current status
#   ./scripts/launch_dual_tv_mcp.sh --stop    # Stop all servers
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
PYTHON_BIN="/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JACKSON_ROOT="/Users/achraf/tradingview-mcp-jackson"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_ANALYSIS="${LOG_DIR}/tradingview_analysis_$(date +%Y%m%d_%H%M%S).log"
LOG_INTERACTIVE="${LOG_DIR}/tradingview_interactive_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "${LOG_DIR}"

# Functions
print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_status() {
    echo -e "${BLUE}[Dual MCP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

check_analysis_server() {
    print_status "Checking tradingview-analysis (Python)..."

    if "$PYTHON_BIN" -c "import tradingview_mcp" 2>/dev/null; then
        print_success "Module installed"
    else
        print_error "Module not installed. Run: pip install tradingview-mcp-server"
        return 1
    fi

    return 0
}

check_interactive_server() {
    print_status "Checking tradingview-interactive (Node.js)..."

    if [ ! -f "$JACKSON_ROOT/src/server.js" ]; then
        print_error "Jackson project not found at $JACKSON_ROOT"
        return 1
    fi

    if [ ! -d "$JACKSON_ROOT/node_modules" ]; then
        print_warning "Dependencies not installed. Installing..."
        cd "$JACKSON_ROOT"
        npm install > /dev/null 2>&1
        cd - > /dev/null
    fi

    print_success "Project ready"
    return 0
}

start_analysis_server() {
    print_status "Starting tradingview-analysis server..."

    export PYTHONUNBUFFERED=1
    "$PYTHON_BIN" -m tradingview_mcp.server > "$LOG_ANALYSIS" 2>&1 &
    ANALYSIS_PID=$!

    sleep 3

    # MCP servers may fork/detach, so check if ANY tradingview process is running
    if pgrep -f "tradingview_mcp.server" > /dev/null 2>&1; then
        print_success "Analysis server started"
        echo "$ANALYSIS_PID" > "${LOG_DIR}/.analysis_pid"
        return 0
    else
        print_error "Analysis server failed to start"
        if [ -s "$LOG_ANALYSIS" ]; then
            cat "$LOG_ANALYSIS" | head -10
        fi
        return 1
    fi
}

start_interactive_server() {
    print_status "Starting tradingview-interactive server..."
    print_warning "Note: Requires TradingView Desktop running with CDP on port 9222"

    cd "$JACKSON_ROOT"
    node src/server.js > "$LOG_INTERACTIVE" 2>&1 &
    INTERACTIVE_PID=$!
    cd - > /dev/null

    sleep 3

    if pgrep -f "node.*server.js" > /dev/null 2>&1; then
        print_success "Interactive server started"
        echo "$INTERACTIVE_PID" > "${LOG_DIR}/.interactive_pid"
        return 0
    else
        print_warning "Interactive server waiting for TradingView"
        print_status "To enable: Run TradingView with --remote-debugging-port=9222"
        echo "$INTERACTIVE_PID" > "${LOG_DIR}/.interactive_pid"
        return 0
    fi
}

show_status() {
    print_header "TradingView MCP Dual Server Status"

    ANALYSIS_PID=$(cat "${LOG_DIR}/.analysis_pid" 2>/dev/null)
    INTERACTIVE_PID=$(cat "${LOG_DIR}/.interactive_pid" 2>/dev/null)

    echo ""
    echo -e "${BLUE}Server 1: tradingview-analysis${NC}"
    if [ ! -z "$ANALYSIS_PID" ] && ps -p "$ANALYSIS_PID" > /dev/null 2>&1; then
        print_success "Running (PID: $ANALYSIS_PID)"
        echo "  Log: $LOG_ANALYSIS"
        echo "  Tools: 30+ market analysis & backtesting"
    else
        print_error "Not running"
    fi

    echo ""
    echo -e "${BLUE}Server 2: tradingview-interactive${NC}"
    if [ ! -z "$INTERACTIVE_PID" ] && ps -p "$INTERACTIVE_PID" > /dev/null 2>&1; then
        print_success "Running (PID: $INTERACTIVE_PID)"
        echo "  Log: $LOG_INTERACTIVE"
        echo "  Tools: 81 chart control, Pine Script, replay"
        echo "  Requires: TradingView Desktop with CDP on port 9222"
    else
        print_error "Not running"
    fi

    echo ""
}

stop_all_servers() {
    print_status "Stopping all servers..."

    ANALYSIS_PID=$(cat "${LOG_DIR}/.analysis_pid" 2>/dev/null)
    INTERACTIVE_PID=$(cat "${LOG_DIR}/.interactive_pid" 2>/dev/null)

    if [ ! -z "$ANALYSIS_PID" ] && ps -p "$ANALYSIS_PID" > /dev/null 2>&1; then
        kill "$ANALYSIS_PID" 2>/dev/null || true
        print_success "Analysis server stopped"
    fi

    if [ ! -z "$INTERACTIVE_PID" ] && ps -p "$INTERACTIVE_PID" > /dev/null 2>&1; then
        kill "$INTERACTIVE_PID" 2>/dev/null || true
        print_success "Interactive server stopped"
    fi

    rm -f "${LOG_DIR}/.analysis_pid" "${LOG_DIR}/.interactive_pid"
    echo ""
}

show_help() {
    cat << EOF
${BLUE}Dual TradingView MCP Server Launcher${NC}

Usage: ./scripts/launch_dual_tv_mcp.sh [OPTIONS]

Options:
  (none)     Start both servers
  --check    Run health checks only
  --status   Show current server status
  --stop     Stop all running servers
  --help     Show this help message

Examples:
  # Start both servers
  ./scripts/launch_dual_tv_mcp.sh

  # Check if everything is configured
  ./scripts/launch_dual_tv_mcp.sh --check

  # Monitor running servers
  ./scripts/launch_dual_tv_mcp.sh --status

  # Stop servers
  ./scripts/launch_dual_tv_mcp.sh --stop

Servers:
  1. tradingview-analysis (Python)
     └─ 30+ tools for market data, technical analysis, backtesting
     └─ Works remotely via Yahoo Finance & crypto exchanges

  2. tradingview-interactive (Node.js)
     └─ 81 tools for chart control, Pine Script, replay mode
     └─ Requires TradingView Desktop running with Chrome DevTools Protocol

EOF
}

# Main execution
case "${1:-}" in
    --check)
        print_header "TradingView MCP Health Check"
        check_analysis_server && check_interactive_server
        if [ $? -eq 0 ]; then
            print_success "All systems ready!"
        else
            print_error "Configuration issues detected"
            exit 1
        fi
        ;;
    --status)
        show_status
        ;;
    --stop)
        stop_all_servers
        print_success "All servers stopped"
        ;;
    --help)
        show_help
        ;;
    *)
        print_header "Starting Dual TradingView MCP Servers"

        # Check dependencies
        echo ""
        check_analysis_server || exit 1
        check_interactive_server || exit 1

        # Start servers
        echo ""
        start_analysis_server || exit 1
        start_interactive_server || exit 1

        # Show summary
        echo ""
        print_header "Dual Server Configuration Active"
        echo ""
        echo -e "${GREEN}✅ Analysis Server${NC} (Python)"
        echo "   • Real-time price quotes (stocks, crypto, commodities)"
        echo "   • 20+ technical indicators"
        echo "   • Backtesting & strategy analysis"
        echo "   • Market screening & sentiment"
        echo "   • No external chart required"
        echo ""
        echo -e "${GREEN}✅ Interactive Server${NC} (Node.js)"
        echo "   • Chart control (symbols, timeframes, indicators)"
        echo "   • Pine Script development & debugging"
        echo "   • Replay mode for practice trading"
        echo "   • Draw on charts (levels, trend lines)"
        echo "   • Multi-pane layouts"
        echo "   • Morning brief workflow"
        echo "   • Requires: TradingView Desktop with port 9222"
        echo ""
        echo -e "${BLUE}Logs:${NC}"
        echo "   Analysis:    $LOG_ANALYSIS"
        echo "   Interactive: $LOG_INTERACTIVE"
        echo ""
        echo -e "${BLUE}Monitor in real-time:${NC}"
        echo "   tail -f $LOG_ANALYSIS"
        echo "   tail -f $LOG_INTERACTIVE"
        echo ""
        echo -e "${BLUE}Stop servers:${NC}"
        echo "   ./scripts/launch_dual_tv_mcp.sh --stop"
        echo ""
        ;;
esac
