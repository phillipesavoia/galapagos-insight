import { usePortfolioSummaries } from "@/hooks/usePortfolioSummaries";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function PortfolioMonitorBar() {
  const { summaries, loading } = usePortfolioSummaries();

  if (loading) return null;
  if (summaries.every(s => s.lastNav === null)) return null;

  return (
    <div className="w-full border-b border-white/5 bg-background/80 backdrop-blur-sm">
      <div className="px-6 py-2">
        <div className="flex items-center gap-3 overflow-x-auto">
          {summaries.map(s => {
            if (s.lastNav === null) return null;
            const isPositive = (s.mtdReturn ?? 0) > 0;
            const isNegative = (s.mtdReturn ?? 0) < 0;
            return (
              <div
                key={s.name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card min-w-fit"
              >
                <span className="text-[11px] font-medium text-foreground">{s.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {s.lastNav.toFixed(2)}
                </span>
                <div className={`flex items-center gap-0.5 text-[11px] font-mono font-semibold ${
                  isPositive ? "text-neon-green" : isNegative ? "text-neon-rose" : "text-muted-foreground"
                }`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{s.mtdReturn?.toFixed(2)}%
                </div>
              </div>
            );
          })}
          <span className="text-[10px] text-muted-foreground/40 ml-auto whitespace-nowrap font-mono uppercase tracking-widest">MTD</span>
        </div>
      </div>
    </div>
  );
}
