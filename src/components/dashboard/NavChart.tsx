import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { PortfolioName } from "@/lib/constants";
import type { NavDataPoint } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const BENCHMARK_OPTIONS = [
  { label: "Nenhum", value: "" },
  { label: "S&P 500 (^SP500TR)", value: "^SP500TR" },
  { label: "US Agg (AGG)", value: "AGG" },
  { label: "MSCI World (URTH)", value: "URTH" },
  { label: "NASDAQ 100 (^NDX)", value: "^NDX" },
  { label: "EM Markets (EEM)", value: "EEM" },
  { label: "High Yield (HYG)", value: "HYG" },
  { label: "T-Bills (BIL)", value: "BIL" },
];

interface NavChartProps {
  portfolio: PortfolioName;
  data: NavDataPoint[];
  loading: boolean;
  hideHeader?: boolean;
}

export function NavChart({ portfolio, data, loading, hideHeader }: NavChartProps) {
  const isEmpty = data.length === 0;

  const [selectedBenchmark, setSelectedBenchmark] = useState("");
  const [benchmarkData, setBenchmarkData] = useState<{ date: string; value: number }[]>([]);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  useEffect(() => {
    if (!selectedBenchmark) {
      setBenchmarkData([]);
      return;
    }
    const fetchBenchmark = async () => {
      setLoadingBenchmark(true);
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
            body: JSON.stringify({ tickers: [selectedBenchmark], range: "1y" }),
          }
        );
        const result = await res.json();
        const d = result[selectedBenchmark];
        if (d?.history) {
          setBenchmarkData(d.history);
        }
      } catch (e) {
        console.warn("Benchmark fetch failed:", e);
      }
      setLoadingBenchmark(false);
    };
    fetchBenchmark();
  }, [selectedBenchmark]);

  // Normalize NAV to base 100
  const normalizedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const firstNav = data[0]?.nav;
    if (!firstNav || firstNav === 0) return [];
    return data.map(d => ({
      ...d,
      normalizedNav: parseFloat(((d.nav / firstNav) * 100).toFixed(4)),
    }));
  }, [data]);

  // Merge normalized data with benchmark
  const mergedData = useMemo(() => {
    return normalizedData.map((point) => {
      const bm = benchmarkData.find((b) => b.date === point.date);
      return { ...point, benchmark: bm?.value ?? null };
    });
  }, [normalizedData, benchmarkData]);

  return (
    <div className={hideHeader ? "" : "rounded-xl border border-border bg-card p-5"}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Retorno Acumulado — {portfolio}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEmpty && !loading ? "Nenhum dado disponível" : "Evolução YTD"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              NAV
            </span>
            {selectedBenchmark && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {selectedBenchmark}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Benchmark selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">Benchmark:</span>
        <select
          value={selectedBenchmark}
          onChange={(e) => setSelectedBenchmark(e.target.value)}
          className="text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground"
        >
          {BENCHMARK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {loadingBenchmark && (
          <span className="text-xs text-muted-foreground">Carregando...</span>
        )}
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : isEmpty ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Sem dados para exibir
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={mergedData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 16%)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }}
              axisLine={{ stroke: "hsl(240 10% 16%)" }}
              tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v: number) => `${v >= 100 ? "+" : ""}${(v - 100).toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(240 15% 7%)",
                border: "1px solid hsl(240 10% 16%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(240 5% 96%)",
              }}
              labelFormatter={(v: string) => {
                const d = new Date(v);
                return d.toLocaleDateString("pt-BR");
              }}
              formatter={(value: number, name: string) => [
                `${value >= 100 ? "+" : ""}${(value - 100).toFixed(2)}%`,
                name === "benchmark" ? selectedBenchmark : "Portfólio",
              ]}
            />
            <Line
              type="monotone"
              dataKey="nav"
              name="NAV"
              stroke="hsl(160 84% 39%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(160 84% 39%)" }}
            />
            {benchmarkData.length > 0 && (
              <Line
                type="monotone"
                dataKey="benchmark"
                name="benchmark"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 4"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
