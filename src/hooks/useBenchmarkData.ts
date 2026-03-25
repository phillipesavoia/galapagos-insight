import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BenchmarkPoint {
  date: string;
  value: number;
}

export function useBenchmarkData(ticker: string) {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setBenchmarkData([]);
      return;
    }
    const fetchBenchmark = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-proxy`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ tickers: [ticker], range: "1y" }),
          }
        );
        const result = await res.json();
        const d = result[ticker];
        if (d?.history) {
          setBenchmarkData(d.history);
        }
      } catch (e) {
        console.warn("Benchmark fetch failed:", e);
      }
      setLoading(false);
    };
    fetchBenchmark();
  }, [ticker]);

  return { benchmarkData, loading };
}
