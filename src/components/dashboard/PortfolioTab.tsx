import { useMemo } from "react";
import { NavChart } from "./NavChart";
import { RiskMetrics } from "./RiskMetrics";
import { HoldingsTable } from "./HoldingsTable";
import { MonthlyReturnsTable } from "./MonthlyReturnsTable";
import { PeriodFilter, type Period } from "./PeriodFilter";
import type { PortfolioName } from "@/lib/constants";
import { filterByPeriod, type NavDataPoint } from "@/lib/utils";
import { useBenchmarkData } from "@/hooks/useBenchmarkData";

interface PortfolioTabProps {
  portfolio: PortfolioName;
  navData: NavDataPoint[];
  loading: boolean;
  period: Period;
  onPeriodChange: (p: Period) => void;
  selectedBenchmark: string;
  onBenchmarkChange: (b: string) => void;
}

export function PortfolioTab({ portfolio, navData, loading, period, onPeriodChange, selectedBenchmark, onBenchmarkChange }: PortfolioTabProps) {
  const filtered = useMemo(() => filterByPeriod(navData, period), [navData, period]);
  const { benchmarkData, loading: loadingBenchmark } = useBenchmarkData(selectedBenchmark);

  // Re-normalize benchmark to match portfolio period start
  const alignedBenchmark = useMemo(() => {
    if (filtered.length === 0 || benchmarkData.length === 0) return [];
    const firstDate = filtered[0].date;
    const bmAtStart = benchmarkData.find((b) => b.date >= firstDate);
    if (!bmAtStart) return [];
    const base = bmAtStart.value;
    return benchmarkData
      .filter((b) => b.date >= firstDate)
      .map((b) => ({ date: b.date, value: parseFloat(((b.value / base) * 100).toFixed(4)) }));
  }, [filtered, benchmarkData]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Retorno Acumulado — {portfolio}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length === 0 && !loading
                ? "Nenhum dado disponível — faça upload via /admin/nav-upload"
                : "Evolução do período selecionado"}
            </p>
          </div>
          <PeriodFilter value={period} onChange={onPeriodChange} />
        </div>
        <NavChart
          portfolio={portfolio}
          data={filtered}
          loading={loading}
          hideHeader
          selectedBenchmark={selectedBenchmark}
          onBenchmarkChange={onBenchmarkChange}
          benchmarkData={alignedBenchmark}
          loadingBenchmark={loadingBenchmark}
        />
      </div>
      <RiskMetrics
        data={filtered}
        loading={loading}
        benchmarkData={alignedBenchmark}
        benchmarkLabel={selectedBenchmark}
      />
      <MonthlyReturnsTable data={navData} loading={loading} />
      <HoldingsTable portfolio={portfolio} />
    </div>
  );
}
