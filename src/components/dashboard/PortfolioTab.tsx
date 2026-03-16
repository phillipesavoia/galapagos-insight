import { useState, useMemo } from "react";
import { NavChart } from "./NavChart";
import { RiskMetrics } from "./RiskMetrics";
import { HoldingsTable } from "./HoldingsTable";
import { MonthlyReturnsTable } from "./MonthlyReturnsTable";
import { PeriodFilter, type Period } from "./PeriodFilter";
import type { PortfolioName, NavDataPoint } from "@/pages/Dashboard";

interface PortfolioTabProps {
  portfolio: PortfolioName;
  navData: NavDataPoint[];
  loading: boolean;
  period: Period;
  onPeriodChange: (p: Period) => void;
}

function filterByPeriod(data: NavDataPoint[], period: Period): NavDataPoint[] {
  if (data.length === 0 || period === "Máx") return data;

  const lastDate = new Date(data[data.length - 1].date);
  let cutoff: Date;

  if (period === "YTD") {
    cutoff = new Date(lastDate.getFullYear(), 0, 1); // Jan 1st of last data year
  } else {
    const months = period === "1M" ? 1 : period === "3M" ? 3 : 12;
    cutoff = new Date(lastDate);
    cutoff.setMonth(cutoff.getMonth() - months);
  }

  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

export function PortfolioTab({ portfolio, navData, loading }: PortfolioTabProps) {
  const [period, setPeriod] = useState<Period>("YTD");
  const filtered = useMemo(() => filterByPeriod(navData, period), [navData, period]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              NAV Diário — {portfolio}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length === 0 && !loading
                ? "Nenhum dado disponível — faça upload via /admin/nav-upload"
                : "Evolução do período selecionado"}
            </p>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
        <NavChart portfolio={portfolio} data={filtered} loading={loading} hideHeader />
      </div>
      <RiskMetrics data={filtered} loading={loading} />
      <MonthlyReturnsTable data={navData} loading={loading} />
      <HoldingsTable portfolio={portfolio} />
    </div>
  );
}
