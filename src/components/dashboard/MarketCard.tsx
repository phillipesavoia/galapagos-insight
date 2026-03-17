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
      <span className="text-[9px] font-mono font-medium text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums font-mono",
          isPositive ? "text-neon-green" : "text-neon-rose"
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
    <div className="group relative glass-card glass-card-hover rounded-2xl p-6 transition-all duration-300 overflow-hidden hover:border-white/10">
      {/* Sparkline background */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData} margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={trend ? "hsl(142, 69%, 58%)" : "hsl(351, 89%, 72%)"}
                  stopOpacity={0.5}
                />
                <stop
                  offset="100%"
                  stopColor={trend ? "hsl(142, 69%, 58%)" : "hsl(351, 89%, 72%)"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={trend ? "hsl(142, 69%, 58%)" : "hsl(351, 89%, 72%)"}
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
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{ticker}</p>
          </div>
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-lg",
              trend
                ? "bg-neon-green/10 text-neon-green"
                : "bg-neon-rose/10 text-neon-rose"
            )}
          >
            {trend ? "▲" : "▼"}
          </span>
        </div>

        <div className="mb-5">
          <span className="text-3xl font-bold text-foreground tabular-nums tracking-tight font-mono">
            {currency === "USD" ? "$" : ""}
            {lastPrice.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Badge label="1D" value={change1D} />
          <Badge label="MTD" value={changeMTD} />
          <Badge label="YTD" value={changeYTD} />
        </div>
      </div>
    </div>
  );
}
