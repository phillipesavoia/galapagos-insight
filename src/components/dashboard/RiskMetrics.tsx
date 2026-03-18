import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="p-5">
              <div className="h-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
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
      color: isPositive ? "text-green-500" : "text-destructive",
    },
    {
      label: "Volatilidade Anualizada",
      value: `${(metrics.volatility * 100).toFixed(2)}%`,
      icon: Activity,
      color: "text-amber-400",
    },
    {
      label: "Índice Sharpe",
      value: metrics.sharpe.toFixed(2),
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Max Drawdown",
      value: `${(metrics.maxDrawdown * 100).toFixed(2)}%`,
      icon: TrendingDown,
      color: "text-destructive",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="border-border bg-card">
          <CardContent className="p-5 flex items-start gap-4">
            <div className={`mt-0.5 ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                {c.label}
              </p>
              <p className={`text-2xl font-semibold mt-1 tabular-nums ${c.label === "Retorno Acumulado" ? c.color : "text-foreground"}`}>
                {c.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
