import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function Rules() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Trading Rules</h1>
        <p className="text-zinc-400 mt-1">Review and track your rule compliance</p>
      </div>

      {/* Rule Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Compliance Score</CardTitle>
            <CheckCircle className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0%</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Violations</CardTitle>
            <AlertTriangle className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Warnings</CardTitle>
            <Info className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-zinc-500 mt-1">No data</p>
          </CardContent>
        </Card>
      </div>

      {/* Trading Rules */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Trading Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-zinc-500">
            <p>No rule data available. Add challenges to see rule compliance tracking.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
