import { Layout } from "@/components/Layout";
import { MarketCard } from "@/components/dashboard/MarketCard";
import { usePortfolioMarketData } from "@/hooks/usePortfolioMarketData";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

const benchmarkPlaceholders = [
  { title: "S&P 500 Total Return", ticker: "SPXT Index" },
  { title: "US Agg Total Return", ticker: "LUATTRUU Index" },
  { title: "US T-Bills 1-3 Month", ticker: "BKT0 Index" },
  { title: "NASDAQ 100", ticker: "NDX Index" },
  { title: "MSCI World", ticker: "MXWO Index" },
  { title: "MSCI Emerging Markets", ticker: "MXEF Index" },
  { title: "US Corporate High Yield", ticker: "LF98TRUU Index" },
  { title: "Wilshire Liquid Alternative", ticker: "WLIQA Index" },
];

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export default function LiveDashboard() {
  const { data: portfolios, loading } = usePortfolioMarketData();

  // Determine last date from portfolios data
  const lastDate = portfolios.length > 0 ? portfolios[0].lastDate : null;
  const formattedDate = lastDate
    ? new Date(lastDate + "T00:00:00").toLocaleDateString("pt-BR")
    : "—";

  return (
    <Layout>
      <div className="w-full px-6 py-6 space-y-10 overflow-x-hidden">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Live Market Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preços de fechamento (D-1) e performance de curto prazo ·{" "}
            <span className="text-primary font-medium">
              📅 Data Base: {formattedDate}
            </span>
          </p>
        </div>

        {/* Benchmarks */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Benchmarks de Mercado
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full font-medium">
              <AlertTriangle className="h-3 w-3" />
              Aguardando API
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {benchmarkPlaceholders.map((b) => (
              <div
                key={b.ticker}
                className="rounded-xl border border-dashed border-border bg-card/50 p-5 flex flex-col items-center justify-center text-center min-h-[140px]"
              >
                <p className="text-sm font-semibold text-foreground">{b.title}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{b.ticker}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Dados disponíveis quando a API de mercado for conectada
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Portfolios */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Portfólios Modelo Galapagos
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : portfolios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum dado de NAV encontrado na base.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {portfolios.map((p) => (
                <MarketCard
                  key={p.name}
                  title={p.name}
                  ticker={p.ticker}
                  lastPrice={p.lastPrice}
                  change1D={p.change1D}
                  changeMTD={p.changeMTD}
                  changeYTD={p.changeYTD}
                  sparklineData={p.sparklineData}
                />
              ))}
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground/60 italic leading-relaxed max-w-3xl">
          *Nota: As alocações refletem a posição atual via Bloomberg (📅 Data Base informada).
          Estas posições podem diferir das alocações discutidas na última reunião mercadológica,
          por conta de movimentações táticas realizadas durante o mês corrente que serão reportadas
          na próxima reunião mercadológica. Para mais detalhes, consulte a equipe de Investor
          Offshore.*
        </p>
      </div>
    </Layout>
  );
}
