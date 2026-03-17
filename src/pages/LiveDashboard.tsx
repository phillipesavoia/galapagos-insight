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
    <div className="glass-card rounded-2xl p-6 space-y-3">
      <Skeleton className="h-4 w-24 bg-white/[0.04]" />
      <Skeleton className="h-8 w-32 bg-white/[0.04]" />
      <Skeleton className="h-3 w-40 bg-white/[0.04]" />
    </div>
  );
}

export default function LiveDashboard() {
  const { data: portfolios, loading } = usePortfolioMarketData();

  const lastDate = portfolios.length > 0 ? portfolios[0].lastDate : null;
  const formattedDate = lastDate
    ? new Date(lastDate + "T00:00:00").toLocaleDateString("pt-BR")
    : "—";

  return (
    <Layout>
      <div className="w-full px-8 py-8 space-y-10 overflow-x-hidden">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Live Market
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Closing prices (D-1) ·{" "}
            <span className="text-neon-green">
              {formattedDate}
            </span>
          </p>
        </div>

        {/* Benchmarks */}
        <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono">
              Market Benchmarks
            </h2>
            <span className="inline-flex items-center gap-1 text-[9px] text-warning bg-warning/10 px-2 py-0.5 rounded-full font-mono">
              <AlertTriangle className="h-2.5 w-2.5" />
              Awaiting API
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
            {benchmarkPlaceholders.map((b) => (
              <div
                key={b.ticker}
                className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[140px] border-dashed"
              >
                <p className="text-sm font-semibold text-foreground">{b.title}</p>
                <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{b.ticker}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-3 font-mono">
                  Pending market API connection
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Portfolios */}
        <section className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <h2 className="text-[10px] font-semibold text-neon-orange uppercase tracking-widest font-mono mb-5">
            Model Portfolios
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : portfolios.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">
              No NAV data found.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
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
        <p className="text-[10px] text-muted-foreground/40 italic leading-relaxed max-w-3xl font-mono">
          *Allocations reflect the current position via Bloomberg (base date shown above).
          Positions may differ from those discussed in the last market meeting due to tactical
          moves during the current month.*
        </p>
      </div>
    </Layout>
  );
}
