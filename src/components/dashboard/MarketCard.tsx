import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface MarketCardProps {
  title: string;
  ticker: string;
  lastPrice: number;
  currency?: string;
  change1D: number;
  changeMTD: number;
  changeYTD: number;
  sparklineData: { value: number }[];
}

function Badge({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}
      >
        {isPositive ? "+" : ""}
        {value.toFixed(2)}%
      </span>
    </div>
  );
}

export function MarketCard({
  title,
  ticker,
  lastPrice,
  currency = "USD",
  change1D,
  changeMTD,
  changeYTD,
  sparklineData,
}: MarketCardProps) {
  const trend = changeYTD >= 0;
  const gradientId = `spark-${ticker.replace(/\s/g, "")}`;

  return (
    <div className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {/* Sparkline background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData} margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={trend ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)"}
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor={trend ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={trend ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)"}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{ticker}</p>
          </div>
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              trend
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {trend ? "▲" : "▼"}
          </span>
        </div>

        <div className="mb-4">
          <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {currency === "USD" ? "$" : ""}
            {lastPrice.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge label="1D" value={change1D} />
          <Badge label="MTD" value={changeMTD} />
          <Badge label="YTD" value={changeYTD} />
        </div>
      </div>
    </div>
  );
}
