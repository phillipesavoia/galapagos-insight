import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { PortfolioName } from "@/pages/Dashboard";

interface Attribution {
  ticker: string;
  name: string;
  weight: number;
  monthReturn: number;
}

const mockData: Record<PortfolioName, Attribution[]> = {
  Conservative: [
    { ticker: "TLT", name: "iShares 20+ Year Treasury ETF", weight: 20.0, monthReturn: 1.85 },
    { ticker: "GLD", name: "SPDR Gold Shares", weight: 15.0, monthReturn: 3.12 },
    { ticker: "LQD", name: "iShares IG Corporate Bond ETF", weight: 20.0, monthReturn: 0.42 },
    { ticker: "SHV", name: "iShares Short Treasury Bond ETF", weight: 30.0, monthReturn: 0.18 },
    { ticker: "CASH", name: "USD Cash", weight: 15.0, monthReturn: 0.04 },
  ],
  Income: [
    { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", weight: 15.0, monthReturn: 2.10 },
    { ticker: "TLT", name: "iShares 20+ Year Treasury ETF", weight: 15.0, monthReturn: 1.85 },
    { ticker: "HYG", name: "iShares High Yield Corporate Bond ETF", weight: 25.0, monthReturn: 0.72 },
    { ticker: "EMB", name: "iShares J.P. Morgan EM Bond ETF", weight: 20.0, monthReturn: -0.35 },
    { ticker: "VNQ", name: "Vanguard Real Estate ETF", weight: 15.0, monthReturn: -1.90 },
    { ticker: "CASH", name: "USD Cash", weight: 10.0, monthReturn: 0.04 },
  ],
  Balanced: [
    { ticker: "SPY", name: "SPDR S&P 500 ETF", weight: 25.0, monthReturn: 3.45 },
    { ticker: "GLD", name: "SPDR Gold Shares", weight: 10.0, monthReturn: 3.12 },
    { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", weight: 10.0, monthReturn: 1.80 },
    { ticker: "EFA", name: "iShares MSCI EAFE ETF", weight: 15.0, monthReturn: 1.20 },
    { ticker: "AGG", name: "iShares Core US Aggregate Bond ETF", weight: 20.0, monthReturn: 0.30 },
    { ticker: "LQD", name: "iShares IG Corporate Bond ETF", weight: 10.0, monthReturn: 0.42 },
    { ticker: "CASH", name: "USD Cash", weight: 10.0, monthReturn: 0.04 },
  ],
  Growth: [
    { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", weight: 20.0, monthReturn: 4.80 },
    { ticker: "SPY", name: "SPDR S&P 500 ETF", weight: 25.0, monthReturn: 3.45 },
    { ticker: "IWM", name: "iShares Russell 2000 ETF", weight: 10.0, monthReturn: 2.60 },
    { ticker: "GLD", name: "SPDR Gold Shares", weight: 10.0, monthReturn: 3.12 },
    { ticker: "EFA", name: "iShares MSCI EAFE ETF", weight: 15.0, monthReturn: 1.20 },
    { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", weight: 10.0, monthReturn: -0.55 },
    { ticker: "CASH", name: "USD Cash", weight: 10.0, monthReturn: 0.04 },
  ],
};

function computeAttribution(data: Attribution[]) {
  return data
    .map((d) => ({
      ...d,
      contribution: parseFloat(((d.weight * d.monthReturn) / 100).toFixed(4)),
    }))
    .sort((a, b) => b.contribution - a.contribution);
}

export function PerformanceAttribution({ portfolio }: { portfolio: PortfolioName }) {
  const rows = useMemo(() => computeAttribution(mockData[portfolio]), [portfolio]);

  const contributors = rows.filter((r) => r.contribution >= 0);
  const detractors = rows.filter((r) => r.contribution < 0);

  const Section = ({
    title,
    icon: Icon,
    items,
    variant,
  }: {
    title: string;
    icon: typeof TrendingUp;
    items: typeof rows;
    variant: "positive" | "negative";
  }) => (
    <div>
      <div className="flex items-center gap-2 px-5 py-3 bg-secondary/30 border-b border-border">
        <Icon className={`h-4 w-4 ${variant === "positive" ? "text-primary" : "text-destructive"}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      {items.map((r) => (
        <tr
          key={r.ticker}
          className="border-b border-border/50 hover:bg-accent/5 transition-colors"
        >
          <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{r.ticker}</td>
          <td className="px-5 py-3 text-foreground text-sm">{r.name}</td>
          <td className="px-5 py-3 text-right font-mono text-sm text-muted-foreground">
            {r.weight.toFixed(1)}%
          </td>
          <td
            className={`px-5 py-3 text-right font-mono text-sm ${
              r.monthReturn >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {r.monthReturn >= 0 ? "+" : ""}
            {r.monthReturn.toFixed(2)}%
          </td>
          <td
            className={`px-5 py-3 text-right font-mono text-sm font-medium ${
              r.contribution >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {r.contribution >= 0 ? "+" : ""}
            {(r.contribution * 100).toFixed(1)} bps
          </td>
        </tr>
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Atribuição de Performance — Mês Atual
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Contribuição = Peso × Retorno no mês (dados simulados)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticker</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ativo</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Peso</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Retorno Mês</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Contribuição</th>
            </tr>
          </thead>
          <tbody>
            <Section title="Top Contribuidores" icon={TrendingUp} items={contributors} variant="positive" />
            {detractors.length > 0 && (
              <Section title="Top Detratores" icon={TrendingDown} items={detractors} variant="negative" />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
