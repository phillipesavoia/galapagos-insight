import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const BLOOMBERG_TO_YAHOO: Record<string, string> = {
  "SPXT Index":     "^SP500TR",   // S&P 500 Total Return
  "LUATTRUU Index": "AGG",        // US Agg Total Return (proxy: iShares Core US Agg)
  "BKT0 Index":     "BIL",        // US T-Bills 1-3 Month (proxy: SPDR 1-3M T-Bill ETF)
  "NDX Index":      "^NDX",       // NASDAQ 100
  "MXWO Index":     "URTH",       // MSCI World (proxy: iShares MSCI World ETF)
  "MXEF Index":     "EEM",        // MSCI Emerging Markets (proxy: iShares MSCI EM ETF)
  "LF98TRUU Index": "HYG",        // US Corporate High Yield (proxy: iShares HY Bond ETF)
  "WLIQA Index":    "QAI",        // Wilshire Liquid Alternative (proxy: IQ Hedge Multi-Strategy)
};

export interface BenchmarkMarketData {
  title: string;
  ticker: string;
  yahooTicker: string;
  lastPrice: number;
  currency: string;
  change1D: number;
  changeMTD: number;
  changeYTD: number;
  sparklineData: { value: number }[];
}

export interface PortfolioMarketData {
  name: string;
  ticker: string;
  lastPrice: number;
  lastDate: string;
  change1D: number;
  changeMTD: number;
  changeYTD: number;
  sparklineData: { value: number }[];
}

import { PORTFOLIOS } from "@/lib/constants";

export function usePortfolioMarketData() {
  const [data, setData] = useState<PortfolioMarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const results: PortfolioMarketData[] = [];

        for (const name of PORTFOLIOS) {
          // Fetch last 60 days for sparkline + MTD calc
          const { data: rows, error } = await supabase
            .from("daily_navs")
            .select("date, nav, daily_return, ytd_return")
            .eq("portfolio_name", name)
            .order("date", { ascending: false })
            .limit(60);

          if (error || !rows || rows.length === 0) continue;

          const sorted = [...rows].reverse(); // oldest first
          const latest = rows[0];
          const lastDate = latest.date;

          // 1D = daily_return of last row
          const change1D = latest.daily_return ?? 0;

          // YTD = ytd_return of last row
          const changeYTD = latest.ytd_return ?? 0;

          // MTD: find last day of previous month, compute return since then
          const currentMonth = lastDate.substring(0, 7); // "YYYY-MM"
          const firstOfMonthRows = sorted.filter(
            (r) => r.date.substring(0, 7) === currentMonth
          );
          let changeMTD = 0;
          if (firstOfMonthRows.length > 1) {
            const prevMonthRows = sorted.filter(
              (r) => r.date.substring(0, 7) < currentMonth
            );
            const lastPrevMonth = prevMonthRows.length > 0
              ? prevMonthRows[prevMonthRows.length - 1]
              : firstOfMonthRows[0];
            changeMTD = ((latest.nav - lastPrevMonth.nav) / lastPrevMonth.nav) * 100;
          }

          // Sparkline: last 30 data points
          const sparklineData = sorted.slice(-30).map((r) => ({ value: r.nav }));

          results.push({
            name,
            ticker: "Model Portfolio",
            lastPrice: parseFloat(latest.nav.toFixed(2)),
            lastDate,
            change1D: parseFloat(change1D.toFixed(2)),
            changeMTD: parseFloat(changeMTD.toFixed(2)),
            changeYTD: parseFloat(changeYTD.toFixed(2)),
            sparklineData,
          });
        }

        setData(results);
      } catch (err) {
        console.error("Error fetching portfolio market data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, []);

  return { data, loading };
}

export function useBenchmarkMarketData(
  benchmarks: { title: string; ticker: string }[]
) {
  const [data, setData] = useState<BenchmarkMarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const results: BenchmarkMarketData[] = [];

      for (const b of benchmarks) {
        const yahooTicker = BLOOMBERG_TO_YAHOO[b.ticker] || b.ticker.split(" ")[0];
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=1mo`,
            { headers: { "User-Agent": "Mozilla/5.0" } }
          );
          if (!res.ok) continue;
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          const timestamps = json?.chart?.result?.[0]?.timestamp || [];
          const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];

          if (!meta?.regularMarketPrice) continue;

          const price = meta.regularMarketPrice;
          const prevClose = meta.previousClose || price;
          const change1D = ((price - prevClose) / prevClose) * 100;

          // Sparkline from closes
          const sparklineData = closes
            .filter((c: number | null) => c != null)
            .map((c: number) => ({ value: c }));

          // MTD: first close of current month vs latest
          const now = new Date();
          const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          let changeMTD = 0;
          if (timestamps.length > 0 && closes.length > 0) {
            for (let i = 0; i < timestamps.length; i++) {
              const d = new Date(timestamps[i] * 1000);
              const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              if (monthStr === currentMonthStr && closes[i] != null) {
                changeMTD = ((price - closes[i]) / closes[i]) * 100;
                break;
              }
            }
          }

          // YTD: approximate from chartPreviousClose if available
          const chartPrevClose = meta.chartPreviousClose || closes[0] || price;
          const changeYTD = ((price - chartPrevClose) / chartPrevClose) * 100;

          results.push({
            title: b.title,
            ticker: b.ticker,
            yahooTicker,
            lastPrice: parseFloat(price.toFixed(2)),
            currency: meta.currency || "USD",
            change1D: parseFloat(change1D.toFixed(2)),
            changeMTD: parseFloat(changeMTD.toFixed(2)),
            changeYTD: parseFloat(changeYTD.toFixed(2)),
            sparklineData: sparklineData.slice(-30),
          });
        } catch (e) {
          console.warn(`Failed to fetch benchmark ${b.ticker}:`, e);
        }
      }

      setData(results);
      setLoading(false);
    }

    if (benchmarks.length > 0) fetchAll();
  }, [benchmarks]);

  return { data, loading };
}
