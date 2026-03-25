import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface InlinePieChartProps {
  title: string;
  data: Array<{ name: string; value: number; color?: string }>;
  donut?: boolean;
}

const DEFAULT_COLORS = ["#d4a84b","#34d399","#60a5fa","#f87171","#a78bfa","#fb923c","#38bdf8","#4ade80"];

function getColor(i: number, color?: string) {
  return color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

export default function InlinePieChart({ title, data, donut = false }: InlinePieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="my-3 rounded-xl border border-white/[0.08] bg-[#0f1525] p-4">
      <p className="mb-3 text-[13px] font-semibold text-foreground">{title}</p>
      <div className="flex items-center gap-4" style={{ height: 200 }}>
        <div className="relative" style={{ width: 200, height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={donut ? 55 : 0}
                outerRadius={90}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={getColor(i, entry.color)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d1b3e",
                  border: "1px solid #d4a84b",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                labelStyle={{ color: "#8094b8" }}
              />
            </PieChart>
          </ResponsiveContainer>
          {donut && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-mono text-sm font-bold text-foreground">
                {total.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[190px] pr-1">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span
                className="shrink-0 rounded-full"
                style={{ width: 8, height: 8, backgroundColor: getColor(i, d.color) }}
              />
              <span className="text-foreground truncate">{d.name}</span>
              <span className="ml-auto font-mono text-[#8094b8] tabular-nums whitespace-nowrap">
                {d.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
