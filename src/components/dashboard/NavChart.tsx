import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { PortfolioName, NavDataPoint } from "@/pages/Dashboard";

interface NavChartProps {
  portfolio: PortfolioName;
  data: NavDataPoint[];
  loading: boolean;
  hideHeader?: boolean;
}

export function NavChart({ portfolio, data, loading, hideHeader }: NavChartProps) {
  const isEmpty = data.length === 0;
  const gradientId = `nav-gradient-${portfolio}`;

  return (
    <div className={hideHeader ? "" : "glass-card rounded-2xl p-6"}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              NAV Diário — {portfolio}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-widest">
              {isEmpty && !loading ? "Nenhum dado disponível" : "Evolução YTD"}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : isEmpty ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-white/5 rounded-2xl">
          Sem dados para exibir
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 69%, 58%)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(142, 69%, 58%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(215 15% 50%)", fontSize: 10 }}
              axisLine={{ stroke: "rgba(255,255,255,0.04)" }}
              tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tick={{ fill: "hsl(215 15% 50%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(222 47% 4%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                fontSize: "11px",
                color: "hsl(210 20% 92%)",
                backdropFilter: "blur(12px)",
              }}
              labelFormatter={(v: string) => {
                const d = new Date(v);
                return d.toLocaleDateString("pt-BR");
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "NAV"]}
            />
            <Area
              type="monotone"
              dataKey="nav"
              name="NAV"
              stroke="hsl(142, 69%, 58%)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(142, 69%, 58%)", stroke: "hsl(222 47% 3%)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
