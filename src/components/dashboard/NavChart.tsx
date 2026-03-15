import {
  ResponsiveContainer,
  LineChart,
  Line,
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
}

export function NavChart({ portfolio, data, loading }: NavChartProps) {
  const isEmpty = data.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            NAV Diário — {portfolio}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEmpty && !loading ? "Nenhum dado disponível — faça upload via /admin/nav-upload" : "Evolução YTD"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            NAV
          </span>
        </div>
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
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
