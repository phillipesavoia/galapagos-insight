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
    { ticker: "LFT", name: "Tesouro Selic 2028", weight: "35.0%", dailyReturn: "+0.04%", contribution: "+0.014%" },
    { ticker: "NTNB25", name: "NTN-B 2025", weight: "20.0%", dailyReturn: "+0.08%", contribution: "+0.016%" },
    { ticker: "CDI+", name: "Crédito IG CDI+1.5%", weight: "25.0%", dailyReturn: "+0.05%", contribution: "+0.013%" },
    { ticker: "USDBRL", name: "Hedge Cambial", weight: "10.0%", dailyReturn: "-0.12%", contribution: "-0.012%" },
    { ticker: "CASH", name: "Caixa", weight: "10.0%", dailyReturn: "+0.04%", contribution: "+0.004%" },
  ],
  Income: [
    { ticker: "NTNB35", name: "NTN-B 2035", weight: "25.0%", dailyReturn: "+0.15%", contribution: "+0.038%" },
    { ticker: "CRED", name: "Debêntures Infra CDI+2%", weight: "20.0%", dailyReturn: "+0.06%", contribution: "+0.012%" },
    { ticker: "HY", name: "High Yield Local", weight: "15.0%", dailyReturn: "+0.09%", contribution: "+0.014%" },
    { ticker: "FII", name: "Fundos Imobiliários", weight: "15.0%", dailyReturn: "-0.22%", contribution: "-0.033%" },
    { ticker: "LFT", name: "Tesouro Selic 2028", weight: "15.0%", dailyReturn: "+0.04%", contribution: "+0.006%" },
    { ticker: "CASH", name: "Caixa", weight: "10.0%", dailyReturn: "+0.04%", contribution: "+0.004%" },
  ],
  Balanced: [
    { ticker: "IBOV", name: "Ibovespa ETF", weight: "20.0%", dailyReturn: "+0.45%", contribution: "+0.090%" },
    { ticker: "SPX", name: "S&P 500 ETF", weight: "15.0%", dailyReturn: "+0.32%", contribution: "+0.048%" },
    { ticker: "NTNB35", name: "NTN-B 2035", weight: "20.0%", dailyReturn: "+0.15%", contribution: "+0.030%" },
    { ticker: "CRED", name: "Crédito IG CDI+1.8%", weight: "15.0%", dailyReturn: "+0.05%", contribution: "+0.008%" },
    { ticker: "GOLD", name: "Ouro", weight: "10.0%", dailyReturn: "+0.28%", contribution: "+0.028%" },
    { ticker: "USDBRL", name: "Hedge Cambial", weight: "10.0%", dailyReturn: "-0.12%", contribution: "-0.012%" },
    { ticker: "CASH", name: "Caixa", weight: "10.0%", dailyReturn: "+0.04%", contribution: "+0.004%" },
  ],
  Growth: [
    { ticker: "IBOV", name: "Ibovespa ETF", weight: "25.0%", dailyReturn: "+0.45%", contribution: "+0.113%" },
    { ticker: "SPX", name: "S&P 500 ETF", weight: "20.0%", dailyReturn: "+0.32%", contribution: "+0.064%" },
    { ticker: "SMLL", name: "Small Caps BR", weight: "10.0%", dailyReturn: "+0.68%", contribution: "+0.068%" },
    { ticker: "TECH", name: "Nasdaq 100 ETF", weight: "10.0%", dailyReturn: "+0.55%", contribution: "+0.055%" },
    { ticker: "NTNB45", name: "NTN-B 2045", weight: "15.0%", dailyReturn: "+0.22%", contribution: "+0.033%" },
    { ticker: "GOLD", name: "Ouro", weight: "10.0%", dailyReturn: "+0.28%", contribution: "+0.028%" },
    { ticker: "CASH", name: "Caixa", weight: "10.0%", dailyReturn: "+0.04%", contribution: "+0.004%" },
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
