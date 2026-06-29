import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, PieChart, LineChart } from "lucide-react";

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-zinc-400 mt-1">Deep dive into your trading performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Return</CardTitle>
            <TrendingUp className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0%</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Sharpe Ratio</CardTitle>
            <BarChart3 className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Win Rate</CardTitle>
            <PieChart className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0%</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Avg Trade Duration</CardTitle>
            <LineChart className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0h</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
              <div className="text-center">
                <LineChart className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No data available</p>
                <p className="text-xs text-zinc-600 mt-1">Add trades to see charts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Profit by Instrument</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
              <div className="text-center">
                <PieChart className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No data available</p>
                <p className="text-xs text-zinc-600 mt-1">Add trades to see charts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Detailed Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400">Winning Trades</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total Wins</span>
                  <span className="text-white">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Avg Win</span>
                  <span className="text-white">$0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Largest Win</span>
                  <span className="text-white">$0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Win Streak</span>
                  <span className="text-white">0</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400">Losing Trades</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total Losses</span>
                  <span className="text-white">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Avg Loss</span>
                  <span className="text-white">$0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Largest Loss</span>
                  <span className="text-white">$0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Loss Streak</span>
                  <span className="text-white">0</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-400">Risk Metrics</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Profit Factor</span>
                  <span className="text-white">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Risk/Reward Ratio</span>
                  <span className="text-white">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Max Drawdown</span>
                  <span className="text-white">0%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Recovery Factor</span>
                  <span className="text-white">0</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Session Analysis */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Trading Session Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-zinc-500">
            <p>No session data available. Add trades to see session analysis.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
