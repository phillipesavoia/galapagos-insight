import { useMemo } from "react";
import { TrendingDown, TrendingUp, Activity, BarChart3 } from "lucide-react";
import type { NavDataPoint } from "@/pages/Dashboard";

const RISK_FREE_RATE = 0.045;
const TRADING_DAYS = 252;

interface RiskMetricsProps {
  data: NavDataPoint[];
  loading: boolean;
}

function computeMetrics(data: NavDataPoint[]) {
  if (data.length < 2) return null;

  const returns = data
    .map((d) => d.daily_return)
    .filter((r): r is number => r !== null && !isNaN(r));

  if (returns.length < 2) return null;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyStd = Math.sqrt(variance) / 100;
  const annualizedVol = dailyStd * Math.sqrt(TRADING_DAYS);

  const firstNav = data[0].nav;
  const lastNav = data[data.length - 1].nav;
  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const years =
    (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (lastNav / firstNav) ** (1 / years) - 1 : 0;

  const sharpe = annualizedVol > 0 ? (cagr - RISK_FREE_RATE) / annualizedVol : 0;

  let peak = data[0].nav;
  let maxDD = 0;
  for (const d of data) {
    if (d.nav > peak) peak = d.nav;
    const dd = (d.nav - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  const accumulatedReturn = ((lastNav / firstNav) - 1);

  return {
    volatility: annualizedVol,
    sharpe,
    maxDrawdown: maxDD,
    accumulatedReturn,
  };
}

export function RiskMetrics({ data, loading }: RiskMetricsProps) {
  const metrics = useMemo(() => computeMetrics(data), [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-6">
            <div className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const isPositive = metrics.accumulatedReturn >= 0;
  const returnPrefix = isPositive ? "+" : "";

  const cards = [
    {
      label: "Retorno Acumulado",
      value: `${returnPrefix}${(metrics.accumulatedReturn * 100).toFixed(2)}%`,
      icon: isPositive ? TrendingUp : TrendingDown,
      neon: isPositive ? "neon-green" : "neon-rose",
      glow: isPositive ? "glow-green" : "glow-rose",
    },
    {
      label: "Volatilidade Anualizada",
      value: `${(metrics.volatility * 100).toFixed(2)}%`,
      icon: Activity,
      neon: "neon-orange",
      glow: "glow-orange",
    },
    {
      label: "Índice Sharpe",
      value: metrics.sharpe.toFixed(2),
      icon: BarChart3,
      neon: "neon-green",
      glow: "glow-green",
    },
    {
      label: "Max Drawdown",
      value: `${(metrics.maxDrawdown * 100).toFixed(2)}%`,
      icon: TrendingDown,
      neon: "neon-rose",
      glow: "glow-rose",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-children">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`glass-card glass-card-hover rounded-2xl p-6 transition-all duration-300 ${c.glow}`}
        >
          <div className="flex items-start gap-3">
            <div className={`text-${c.neon} mt-0.5`}>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase font-mono">
                {c.label}
              </p>
              <p className={`text-2xl font-semibold mt-1.5 tabular-nums font-mono text-${c.neon}`}>
                {c.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
