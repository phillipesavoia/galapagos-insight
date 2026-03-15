import { NavChart } from "./NavChart";
import { RiskMetrics } from "./RiskMetrics";
import { PerformanceAttribution } from "./PerformanceAttribution";
import { HoldingsTable } from "./HoldingsTable";
import type { PortfolioName, NavDataPoint } from "@/pages/Dashboard";
interface PortfolioTabProps {
  portfolio: PortfolioName;
  navData: NavDataPoint[];
  loading: boolean;
}

export function PortfolioTab({ portfolio, navData, loading }: PortfolioTabProps) {
  return (
    <div className="space-y-6">
      <NavChart portfolio={portfolio} data={navData} loading={loading} />
      <RiskMetrics data={navData} loading={loading} />
      <HoldingsTable portfolio={portfolio} />
    </div>
  );
}
