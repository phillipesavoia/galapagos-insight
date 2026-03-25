import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Activity, BarChart3 } from "lucide-react";
import type { NavDataPoint } from "@/lib/utils";

const RISK_FREE_RATE = 0.045;
const TRADING_DAYS = 252;

interface RiskMetricsProps {
  data: NavDataPoint[];
  loading: boolean;
  benchmarkData?: { date: string; value: number }[];
  benchmarkLabel?: string;
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

  const accumulatedReturn = (lastNav / firstNav) - 1;

  return {
    volatility: annualizedVol,
    sharpe,
    maxDrawdown: maxDD,
    accumulatedReturn,
  };
}

function computeBenchmarkMetrics(bmData: { date: string; value: number }[]) {
  if (bmData.length < 2) return null;

  // Compute daily returns from normalized values
  const dailyReturns: number[] = [];
  for (let i = 1; i < bmData.length; i++) {
    const ret = ((bmData[i].value - bmData[i - 1].value) / bmData[i - 1].value) * 100;
    dailyReturns.push(ret);
  }

  if (dailyReturns.length < 2) return null;

  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const dailyStd = Math.sqrt(variance) / 100;
  const annualizedVol = dailyStd * Math.sqrt(TRADING_DAYS);

  const firstVal = bmData[0].value;
  const lastVal = bmData[bmData.length - 1].value;
  const firstDate = new Date(bmData[0].date);
  const lastDate = new Date(bmData[bmData.length - 1].date);
  const years =
    (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (lastVal / firstVal) ** (1 / years) - 1 : 0;

  const sharpe = annualizedVol > 0 ? (cagr - RISK_FREE_RATE) / annualizedVol : 0;

  let peak = bmData[0].value;
  let maxDD = 0;
  for (const d of bmData) {
    if (d.value > peak) peak = d.value;
    const dd = (d.value - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  const accumulatedReturn = (lastVal / firstVal) - 1;

  return {
    volatility: annualizedVol,
    sharpe,
    maxDrawdown: maxDD,
    accumulatedReturn,
  };
}

export function RiskMetrics({ data, loading, benchmarkData = [], benchmarkLabel }: RiskMetricsProps) {
  const metrics = useMemo(() => computeMetrics(data), [data]);
  const bmMetrics = useMemo(() => computeBenchmarkMetrics(benchmarkData), [benchmarkData]);

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
      bmValue: bmMetrics ? `${bmMetrics.accumulatedReturn >= 0 ? "+" : ""}${(bmMetrics.accumulatedReturn * 100).toFixed(2)}%` : null,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? "text-green-500" : "text-destructive",
      bmColor: bmMetrics ? (bmMetrics.accumulatedReturn >= 0 ? "text-green-500/60" : "text-destructive/60") : "",
    },
    {
      label: "Volatilidade Anualizada",
      value: `${(metrics.volatility * 100).toFixed(2)}%`,
      bmValue: bmMetrics ? `${(bmMetrics.volatility * 100).toFixed(2)}%` : null,
      icon: Activity,
      color: "text-amber-400",
      bmColor: "text-amber-400/60",
    },
    {
      label: "Índice Sharpe",
      value: metrics.sharpe.toFixed(2),
      bmValue: bmMetrics ? bmMetrics.sharpe.toFixed(2) : null,
      icon: BarChart3,
      color: metrics.sharpe >= 0 ? "text-primary" : "text-destructive",
      bmColor: bmMetrics ? (bmMetrics.sharpe >= 0 ? "text-primary/60" : "text-destructive/60") : "",
    },
    {
      label: "Max Drawdown",
      value: `${(metrics.maxDrawdown * 100).toFixed(2)}%`,
      bmValue: bmMetrics ? `${(bmMetrics.maxDrawdown * 100).toFixed(2)}%` : null,
      icon: TrendingDown,
      color: "text-destructive",
      bmColor: "text-destructive/60",
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
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                {c.label}
              </p>
              <div className="mt-1.5 space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Portfólio</span>
                  <span className={`text-xl font-semibold tabular-nums ${c.label === "Retorno Acumulado" ? c.color : "text-foreground"}`}>
                    {c.value}
                  </span>
                </div>
                {c.bmValue && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground/60">{benchmarkLabel}</span>
                    <span className={`text-sm font-medium tabular-nums ${c.bmColor}`}>
                      {c.bmValue}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
