import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PortfolioSummary {
  name: string;
  lastNav: number | null;
  lastDate: string | null;
  mtdReturn: number | null;
}

const ALL_PORTFOLIOS = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];

export function usePortfolioSummaries() {
  const [summaries, setSummaries] = useState<PortfolioSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const results: PortfolioSummary[] = [];

      for (const name of ALL_PORTFOLIOS) {
        const { data: rows } = await supabase
          .from("daily_navs")
          .select("date, nav")
          .eq("portfolio_name", name)
          .order("date", { ascending: false })
          .limit(40);

        if (!rows || rows.length === 0) {
          results.push({ name, lastNav: null, lastDate: null, mtdReturn: null });
          continue;
        }

        const latest = rows[0];
        const sorted = [...rows].reverse();
        const currentMonth = latest.date.substring(0, 7);
        const prevMonthRows = sorted.filter(r => r.date.substring(0, 7) < currentMonth);
        const baseNav = prevMonthRows.length > 0 ? prevMonthRows[prevMonthRows.length - 1].nav : sorted[0].nav;
        const mtdReturn = baseNav > 0 ? ((Number(latest.nav) - Number(baseNav)) / Number(baseNav)) * 100 : 0;

        results.push({
          name,
          lastNav: Number(latest.nav),
          lastDate: latest.date,
          mtdReturn: parseFloat(mtdReturn.toFixed(2)),
        });
      }

      setSummaries(results);
      setLoading(false);
    }
    fetch();
  }, []);

  return { summaries, loading };
}
