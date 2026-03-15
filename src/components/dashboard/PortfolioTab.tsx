import { NavChart } from "./NavChart";
import { HoldingsTable } from "./HoldingsTable";
import type { PortfolioName } from "@/pages/Dashboard";

interface PortfolioTabProps {
  portfolio: PortfolioName;
}

export function PortfolioTab({ portfolio }: PortfolioTabProps) {
  return (
    <div className="space-y-6">
      <NavChart portfolio={portfolio} />
      <HoldingsTable portfolio={portfolio} />
    </div>
  );
}
