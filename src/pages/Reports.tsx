import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { NavDataPoint, PortfolioName } from "@/pages/Dashboard";

type Period = "MTD" | "3M" | "6M" | "YTD" | "1Y";

const ALL_PORTFOLIOS = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];
const PERIODS: { label: string; value: Period }[] = [
  { label: "Mês Atual", value: "MTD" },
  { label: "3 Meses", value: "3M" },
  { label: "6 Meses", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1 Ano", value: "1Y" },
];

const BENCHMARK_OPTIONS = [
  { ticker: "SPY", name: "S&P 500 (SPY)" },
  { ticker: "ACWI", name: "MSCI World (ACWI)" },
  { ticker: "TLT", name: "US 20Y Treasury (TLT)" },
  { ticker: "AGG", name: "Bloomberg Agg Bond (AGG)" },
];

interface BenchmarkData {
  ticker: string;
  name: string;
  data: { date: string; price: number }[];
}

interface Holding {
  asset_name: string;
  ticker: string | null;
  asset_class: string;
  weight_percentage: number;
}

function filterByPeriod<T extends { date: string }>(data: T[], period: Period): T[] {
  if (data.length === 0) return data;
  const lastDate = new Date(data[data.length - 1].date);
  let cutoff: Date;
  switch (period) {
    case "MTD":
      cutoff = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
      break;
    case "YTD":
      cutoff = new Date(lastDate.getFullYear(), 0, 1);
      break;
    case "3M":
      cutoff = new Date(lastDate);
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    case "6M":
      cutoff = new Date(lastDate);
      cutoff.setMonth(cutoff.getMonth() - 6);
      break;
    case "1Y":
      cutoff = new Date(lastDate);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    default:
      return data;
  }
  return data.filter(d => d.date >= cutoff.toISOString().slice(0, 10));
}

export default function Reports() {
  const [clientName, setClientName] = useState("");
  const [portfolio, setPortfolio] = useState("Conservative");
  const [period, setPeriod] = useState<Period>("YTD");
  const [comment, setComment] = useState("");
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(["SPY"]);
  const [navData, setNavData] = useState<NavDataPoint[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingBenchmarks, setFetchingBenchmarks] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Relatorio_${portfolio}_${clientName || "Cliente"}`,
  });

  // Fetch NAV data
  useEffect(() => {
    const fetchNav = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("daily_navs")
        .select("date, nav, daily_return, ytd_return")
        .eq("portfolio_name", portfolio)
        .order("date", { ascending: true })
        .limit(1000);
      if (!error && data) {
        setNavData(data.map((r: any) => ({
          date: r.date, nav: Number(r.nav),
          daily_return: r.daily_return != null ? Number(r.daily_return) : null,
          ytd_return: r.ytd_return != null ? Number(r.ytd_return) : null,
        })));
      } else {
        setNavData([]);
      }
      setLoading(false);
    };
    fetchNav();
  }, [portfolio]);

  // Fetch holdings
  useEffect(() => {
    const fetchHoldings = async () => {
      const { data } = await supabase
        .from("portfolio_holdings")
        .select("asset_name, ticker, asset_class, weight_percentage")
        .eq("portfolio_name", portfolio)
        .eq("is_active", true)
        .order("weight_percentage", { ascending: false })
        .limit(10);
      setHoldings(data || []);
    };
    fetchHoldings();
  }, [portfolio]);

  // Fetch benchmark data from DB
  useEffect(() => {
    const fetchBench = async () => {
      if (selectedBenchmarks.length === 0) { setBenchmarkData([]); return; }
      const results: BenchmarkData[] = [];
      for (const ticker of selectedBenchmarks) {
        const { data } = await supabase
          .from("benchmark_prices")
          .select("date, price, name")
          .eq("ticker", ticker)
          .order("date", { ascending: true })
          .limit(1000);
        if (data && data.length > 0) {
          results.push({
            ticker,
            name: data[0].name || ticker,
            data: data.map((r: any) => ({ date: r.date, price: Number(r.price) })),
          });
        }
      }
      setBenchmarkData(results);
    };
    fetchBench();
  }, [selectedBenchmarks]);

  const handleFetchBenchmarks = async () => {
    setFetchingBenchmarks(true);
    try {
      await supabase.functions.invoke("fetch-benchmark-data", {
        body: { tickers: selectedBenchmarks },
      });
      // Refresh data
      const results: BenchmarkData[] = [];
      for (const ticker of selectedBenchmarks) {
        const { data } = await supabase
          .from("benchmark_prices")
          .select("date, price, name")
          .eq("ticker", ticker)
          .order("date", { ascending: true })
          .limit(1000);
        if (data && data.length > 0) {
          results.push({ ticker, name: data[0].name || ticker, data: data.map((r: any) => ({ date: r.date, price: Number(r.price) })) });
        }
      }
      setBenchmarkData(results);
    } catch (err) {
      console.error("Benchmark fetch error:", err);
    } finally {
      setFetchingBenchmarks(false);
    }
  };

  const toggleBenchmark = (ticker: string) => {
    setSelectedBenchmarks(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : prev.length >= 3 ? prev : [...prev, ticker]
    );
  };

  const filteredNav = useMemo(() => filterByPeriod(navData, period), [navData, period]);
  const filteredBenchmarks = useMemo(() =>
    benchmarkData.map(b => ({ ...b, data: filterByPeriod(b.data, period) })),
    [benchmarkData, period]
  );

  const periodLabel = PERIODS.find(p => p.value === period)?.label || period;

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Relatórios & Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">Compare portfólios com benchmarks e gere relatórios PDF</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-6 p-6 min-h-full">
            {/* Left: Controls */}
            <div className="w-80 shrink-0 space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Configuração</h2>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome do Cliente</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Selecionar Modelo</label>
                  <select value={portfolio} onChange={e => setPortfolio(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                    {ALL_PORTFOLIOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Período</label>
                  <select value={period} onChange={e => setPeriod(e.target.value as Period)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Benchmarks (até 3)</label>
                  <div className="flex flex-wrap gap-2">
                    {BENCHMARK_OPTIONS.map(b => (
                      <button key={b.ticker} onClick={() => toggleBenchmark(b.ticker)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          selectedBenchmarks.includes(b.ticker)
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/40"
                        }`}>
                        {b.ticker}
                      </button>
                    ))}
                  </div>
                  {selectedBenchmarks.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleFetchBenchmarks} disabled={fetchingBenchmarks}
                      className="mt-2 gap-1.5 text-xs text-muted-foreground w-full">
                      {fetchingBenchmarks ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Atualizar Dados de Benchmarks (Finnhub)
                    </Button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Comentário de Mercado</label>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Cole aqui o resumo de mercado..."
                    rows={6}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y" />
                </div>
              </div>

              <Button onClick={() => handlePrint()} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Exportar para PDF
              </Button>
            </div>

            {/* Right: A4 Preview */}
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-[210mm]">
                <ReportPreview
                  ref={printRef}
                  portfolio={portfolio as PortfolioName}
                  clientName={clientName}
                  periodLabel={periodLabel}
                  data={filteredNav}
                  loading={loading}
                  comment={comment}
                  benchmarks={filteredBenchmarks}
                  topHoldings={holdings.slice(0, 5)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
