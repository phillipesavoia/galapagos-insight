import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { PortfolioName } from "@/pages/Dashboard";

// Mock YTD NAV data per portfolio
const baseSeed: Record<PortfolioName, number> = {
  Conservative: 100,
  Income: 100,
  Balanced: 100,
  Growth: 100,
};

const volatility: Record<PortfolioName, number> = {
  Conservative: 0.15,
  Income: 0.25,
  Balanced: 0.4,
  Growth: 0.6,
};

function generateNavData(portfolio: PortfolioName) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let nav = baseSeed[portfolio];
  const vol = volatility[portfolio];
  const data: { month: string; nav: number; benchmark: number }[] = [];
  let bench = 100;

  // Use a seeded-ish approach per portfolio
  const seed = portfolio.charCodeAt(0);
  for (let i = 0; i < 12; i++) {
    const pseudo = Math.sin(seed * (i + 1) * 0.7) * vol + 0.3;
    nav = +(nav * (1 + pseudo / 100 * (i + 1))).toFixed(2);
    bench = +(bench * (1 + (pseudo * 0.6) / 100 * (i + 1))).toFixed(2);
    data.push({ month: months[i], nav, benchmark: bench });
  }
  return data;
}

interface NavChartProps {
  portfolio: PortfolioName;
}

export function NavChart({ portfolio }: NavChartProps) {
  const data = generateNavData(portfolio);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            NAV Diário — {portfolio}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evolução YTD (dados simulados)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Portfólio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            Benchmark
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 16%)" />
          <XAxis
            dataKey="month"
            tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }}
            axisLine={{ stroke: "hsl(240 10% 16%)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(240 15% 7%)",
              border: "1px solid hsl(240 10% 16%)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(240 5% 96%)",
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
          <Line
            type="monotone"
            dataKey="benchmark"
            name="Benchmark"
            stroke="hsl(240 5% 45%)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
