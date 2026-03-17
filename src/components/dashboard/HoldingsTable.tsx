import type { PortfolioName } from "@/pages/Dashboard";

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
};

interface HoldingsTableProps {
  portfolio: PortfolioName;
}

export function HoldingsTable({ portfolio }: HoldingsTableProps) {
  const holdings = mockHoldings[portfolio];

  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-fade-up">
      <div className="px-6 py-5 border-b border-white/5">
        <h3 className="text-sm font-semibold text-foreground">
          Composição — {portfolio}
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-widest">
          Tickers, pesos e retorno diário
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-3 text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono">
                Ticker
              </th>
              <th className="text-left px-6 py-3 text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono">
                Ativo
              </th>
              <th className="text-right px-6 py-3 text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono">
                Peso
              </th>
              <th className="text-right px-6 py-3 text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono">
                Retorno
              </th>
              <th className="text-right px-6 py-3 text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono">
                Contrib.
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
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-3 font-mono text-xs font-semibold text-foreground">
                    {h.ticker}
                  </td>
                  <td className="px-6 py-3 text-xs text-foreground/80">{h.name}</td>
                  <td className="px-6 py-3 text-right text-muted-foreground font-mono text-xs">
                    {h.weight}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-mono text-xs ${
                      isPositive
                        ? "text-neon-green"
                        : isNegative
                        ? "text-neon-rose"
                        : "text-muted-foreground"
                    }`}
                  >
                    {h.dailyReturn}
                  </td>
                  <td
                    className={`px-6 py-3 text-right font-mono text-xs ${
                      h.contribution.startsWith("+")
                        ? "text-neon-green"
                        : h.contribution.startsWith("-")
                        ? "text-neon-rose"
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
