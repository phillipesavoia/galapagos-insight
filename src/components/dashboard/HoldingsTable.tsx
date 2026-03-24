import type { PortfolioName } from "@/lib/constants";

interface Holding {
  ticker: string;
  name: string;
  weight: string;
  dailyReturn: string;
  contribution: string;
}

const mockHoldings: Record<PortfolioName, Holding[]> = {
  Conservative: [
    { ticker: "SHV", name: "iShares Short Treasury Bond ETF", weight: "30.0%", dailyReturn: "+0.02%", contribution: "+0.006%" },
    { ticker: "TLT", name: "iShares 20+ Year Treasury ETF", weight: "20.0%", dailyReturn: "+0.12%", contribution: "+0.024%" },
    { ticker: "LQD", name: "iShares IG Corporate Bond ETF", weight: "20.0%", dailyReturn: "+0.05%", contribution: "+0.010%" },
    { ticker: "GLD", name: "SPDR Gold Shares", weight: "15.0%", dailyReturn: "+0.28%", contribution: "+0.042%" },
    { ticker: "CASH", name: "USD Cash", weight: "15.0%", dailyReturn: "+0.01%", contribution: "+0.002%" },
  ],
  Income: [
    { ticker: "HYG", name: "iShares High Yield Corporate Bond ETF", weight: "25.0%", dailyReturn: "+0.09%", contribution: "+0.023%" },
    { ticker: "EMB", name: "iShares J.P. Morgan EM Bond ETF", weight: "20.0%", dailyReturn: "+0.06%", contribution: "+0.012%" },
    { ticker: "VNQ", name: "Vanguard Real Estate ETF", weight: "15.0%", dailyReturn: "-0.18%", contribution: "-0.027%" },
    { ticker: "TLT", name: "iShares 20+ Year Treasury ETF", weight: "15.0%", dailyReturn: "+0.12%", contribution: "+0.018%" },
    { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", weight: "15.0%", dailyReturn: "+0.15%", contribution: "+0.023%" },
    { ticker: "CASH", name: "USD Cash", weight: "10.0%", dailyReturn: "+0.01%", contribution: "+0.001%" },
  ],
  Balanced: [
    { ticker: "SPY", name: "SPDR S&P 500 ETF", weight: "25.0%", dailyReturn: "+0.32%", contribution: "+0.080%" },
    { ticker: "EFA", name: "iShares MSCI EAFE ETF", weight: "15.0%", dailyReturn: "+0.18%", contribution: "+0.027%" },
    { ticker: "AGG", name: "iShares Core US Aggregate Bond ETF", weight: "20.0%", dailyReturn: "+0.04%", contribution: "+0.008%" },
    { ticker: "GLD", name: "SPDR Gold Shares", weight: "10.0%", dailyReturn: "+0.28%", contribution: "+0.028%" },
    { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", weight: "10.0%", dailyReturn: "+0.22%", contribution: "+0.022%" },
    { ticker: "LQD", name: "iShares IG Corporate Bond ETF", weight: "10.0%", dailyReturn: "+0.05%", contribution: "+0.005%" },
    { ticker: "CASH", name: "USD Cash", weight: "10.0%", dailyReturn: "+0.01%", contribution: "+0.001%" },
  ],
  Growth: [
    { ticker: "SPY", name: "SPDR S&P 500 ETF", weight: "25.0%", dailyReturn: "+0.32%", contribution: "+0.080%" },
    { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", weight: "20.0%", dailyReturn: "+0.55%", contribution: "+0.110%" },
    { ticker: "EFA", name: "iShares MSCI EAFE ETF", weight: "15.0%", dailyReturn: "+0.18%", contribution: "+0.027%" },
    { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", weight: "10.0%", dailyReturn: "+0.22%", contribution: "+0.022%" },
    { ticker: "GLD", name: "SPDR Gold Shares", weight: "10.0%", dailyReturn: "+0.28%", contribution: "+0.028%" },
    { ticker: "IWM", name: "iShares Russell 2000 ETF", weight: "10.0%", dailyReturn: "+0.45%", contribution: "+0.045%" },
    { ticker: "CASH", name: "USD Cash", weight: "10.0%", dailyReturn: "+0.01%", contribution: "+0.001%" },
  ],
  Liquidity: [
    { ticker: "SHV", name: "iShares Short Treasury Bond ETF", weight: "40.0%", dailyReturn: "+0.02%", contribution: "+0.008%" },
    { ticker: "BIL", name: "SPDR Bloomberg 1-3 Month T-Bill ETF", weight: "30.0%", dailyReturn: "+0.01%", contribution: "+0.003%" },
    { ticker: "CASH", name: "USD Cash", weight: "30.0%", dailyReturn: "+0.01%", contribution: "+0.003%" },
  ],
  "Bond Portfolio": [
    { ticker: "AGG", name: "iShares Core US Aggregate Bond ETF", weight: "30.0%", dailyReturn: "+0.04%", contribution: "+0.012%" },
    { ticker: "TLT", name: "iShares 20+ Year Treasury ETF", weight: "25.0%", dailyReturn: "+0.12%", contribution: "+0.030%" },
    { ticker: "LQD", name: "iShares IG Corporate Bond ETF", weight: "20.0%", dailyReturn: "+0.05%", contribution: "+0.010%" },
    { ticker: "EMB", name: "iShares J.P. Morgan EM Bond ETF", weight: "15.0%", dailyReturn: "+0.06%", contribution: "+0.009%" },
    { ticker: "CASH", name: "USD Cash", weight: "10.0%", dailyReturn: "+0.01%", contribution: "+0.001%" },
  ],
};

interface HoldingsTableProps {
  portfolio: PortfolioName;
}

export function HoldingsTable({ portfolio }: HoldingsTableProps) {
  const holdings = mockHoldings[portfolio];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Composição — {portfolio}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tickers, pesos e retorno diário (dados simulados)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Ticker
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Ativo
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Peso
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Retorno Diário
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Contribuição
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const isPositive = h.dailyReturn.startsWith("+");
              const isNegative = h.dailyReturn.startsWith("-");
              return (
                <tr
                  key={h.ticker}
                  className="border-b border-border/50 hover:bg-accent/5 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">
                    {h.ticker}
                  </td>
                  <td className="px-5 py-3 text-foreground">{h.name}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground font-mono">
                    {h.weight}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono ${
                      isPositive
                        ? "text-primary"
                        : isNegative
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {h.dailyReturn}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono ${
                      h.contribution.startsWith("+")
                        ? "text-primary"
                        : h.contribution.startsWith("-")
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {h.contribution}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
