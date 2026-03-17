import { usePortfolioSummaries } from "@/hooks/usePortfolioSummaries";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function PortfolioMonitorBar() {
  const { summaries, loading } = usePortfolioSummaries();

  if (loading) return null;
  if (summaries.every(s => s.lastNav === null)) return null;

  return (
    <div className="w-full border-b border-border bg-black">
      <div className="max-w-7xl mx-auto px-6 py-2">
        <div className="flex items-center gap-3 overflow-x-auto">
          {summaries.map(s => {
            if (s.lastNav === null) return null;
            const isPositive = (s.mtdReturn ?? 0) > 0;
            const isNegative = (s.mtdReturn ?? 0) < 0;
            return (
              <div
                key={s.name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border min-w-fit"
              >
                <span className="text-xs font-medium text-white">{s.name}</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {s.lastNav.toFixed(2)}
                </span>
                <div className={`flex items-center gap-0.5 text-xs font-mono ${
                  isPositive ? "text-ares-green" : isNegative ? "text-ares-pink" : "text-muted-foreground"
                }`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{s.mtdReturn?.toFixed(2)}%
                </div>
              </div>
            );
          })}
          <span className="text-[10px] text-muted-foreground/60 ml-auto whitespace-nowrap">MTD</span>
        </div>
      </div>
    </div>
  );
}
