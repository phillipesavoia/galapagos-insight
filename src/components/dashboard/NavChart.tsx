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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-xl px-3 py-2 text-[11px] font-mono border border-white/10 backdrop-blur-md"
      style={{ backgroundColor: "#050b18" }}>
      <p className="text-muted-foreground mb-0.5">
        {new Date(label).toLocaleDateString("pt-BR")}
      </p>
      <p className="text-neon-green font-semibold">
        ${typeof value === "number" ? value.toFixed(2) : value}
      </p>
    </div>
  );
}

export function NavChart({ portfolio, data, loading, hideHeader }: NavChartProps) {
  const isEmpty = data.length === 0;
  const gradientId = `nav-gradient-${portfolio}`;

  // Determine trend for color
  const isPositive = data.length >= 2 ? data[data.length - 1].nav >= data[0].nav : true;
  const strokeColor = isPositive ? "hsl(142, 69%, 58%)" : "hsl(351, 89%, 72%)";

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
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.20} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              horizontal={true}
              vertical={false}
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
              tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="nav"
              name="NAV"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: strokeColor, stroke: "#020617", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
