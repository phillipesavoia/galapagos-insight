import { Layout } from "@/components/Layout";
import { MarketCard, MarketCardProps } from "@/components/dashboard/MarketCard";

// --- Mock sparkline generator ---
function generateSparkline(base: number, volatility: number, trend: number, days = 30) {
  const data: { value: number }[] = [];
  let v = base;
  for (let i = 0; i < days; i++) {
    v += (Math.random() - 0.5 + trend * 0.01) * volatility;
    data.push({ value: parseFloat(v.toFixed(2)) });
  }
  return data;
}

// --- High-fidelity mock data ---
const benchmarks: MarketCardProps[] = [
  {
    title: "US T-Bills (1-3M)",
    ticker: "BIL US",
    lastPrice: 91.67,
    change1D: 0.01,
    changeMTD: 0.12,
    changeYTD: 0.98,
    sparklineData: generateSparkline(91.5, 0.05, 0.3),
  },
  {
    title: "US Aggregate Bond",
    ticker: "AGG US",
    lastPrice: 98.34,
    change1D: -0.08,
    changeMTD: -0.42,
    changeYTD: -1.23,
    sparklineData: generateSparkline(99.5, 0.4, -0.5),
  },
  {
    title: "MSCI All Country World",
    ticker: "ACWI US",
    lastPrice: 109.52,
    change1D: 0.34,
    changeMTD: 1.87,
    changeYTD: 6.41,
    sparklineData: generateSparkline(103, 1.2, 1),
  },
];

const portfolios: MarketCardProps[] = [
  {
    title: "Conservative",
    ticker: "Model Portfolio",
    lastPrice: 1042.18,
    change1D: 0.03,
    changeMTD: 0.28,
    changeYTD: 1.74,
    sparklineData: generateSparkline(1030, 2, 0.5),
  },
  {
    title: "Income",
    ticker: "Model Portfolio",
    lastPrice: 1087.55,
    change1D: 0.07,
    changeMTD: 0.51,
    changeYTD: 3.12,
    sparklineData: generateSparkline(1055, 4, 0.8),
  },
  {
    title: "Balanced",
    ticker: "Model Portfolio",
    lastPrice: 1134.92,
    change1D: 0.18,
    changeMTD: 1.02,
    changeYTD: 5.47,
    sparklineData: generateSparkline(1075, 6, 1),
  },
  {
    title: "Growth",
    ticker: "Model Portfolio",
    lastPrice: 1198.30,
    change1D: 0.31,
    changeMTD: 1.64,
    changeYTD: 8.23,
    sparklineData: generateSparkline(1105, 9, 1.2),
  },
];

export default function LiveDashboard() {
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
              📅 Data Base: {new Date(Date.now() - 86400000).toLocaleDateString("pt-BR")}
            </span>
          </p>
        </div>

        {/* Benchmarks */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Benchmarks de Mercado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {benchmarks.map((b) => (
              <MarketCard key={b.ticker} {...b} />
            ))}
          </div>
        </section>

        {/* Portfolios */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Portfólios Modelo Galapagos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {portfolios.map((p) => (
              <MarketCard key={p.title} {...p} />
            ))}
          </div>
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
