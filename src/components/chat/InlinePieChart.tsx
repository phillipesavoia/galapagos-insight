import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface InlinePieChartProps {
  title: string;
  data: Array<{ name: string; value: number; color?: string }>;
  donut?: boolean;
}

const COLORS = [
  "#d4a84b", "#34d399", "#60a5fa", "#f87171", "#a78bfa",
  "#fb923c", "#38bdf8", "#4ade80", "#f472b6", "#2dd4bf",
];

function getColor(i: number, color?: string) {
  return color || COLORS[i % COLORS.length];
}

export default function InlinePieChart({ title, data, donut = false }: InlinePieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div
      className="my-5 rounded-2xl border shadow-lg"
      style={{
        background: "#050a14",
        borderColor: "rgba(255,255,255,0.08)",
        padding: "20px 24px 16px",
      }}
    >
      <p
        className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: "#64748b" }}
      >
        {title}
      </p>

      <div className="flex items-center gap-6" style={{ minHeight: 260 }}>
        {/* Chart */}
        <div className="relative shrink-0" style={{ width: 260, height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={donut ? 65 : 0}
                outerRadius={115}
                strokeWidth={1}
                stroke="rgba(0,0,0,0.3)"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={getColor(i, entry.color)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a1628",
                  border: "1px solid rgba(212,168,75,0.4)",
                  borderRadius: 10,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                labelStyle={{ color: "#8094b8" }}
              />
            </PieChart>
          </ResponsiveContainer>
          {donut && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-mono text-base font-bold" style={{ color: "#e2e8f0" }}>
                {total.toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[250px] pr-1">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="shrink-0 rounded-full"
                style={{ width: 10, height: 10, backgroundColor: getColor(i, d.color) }}
              />
              <span className="text-[12px] leading-tight" style={{ color: "#cbd5e1" }}>
                {d.name}
              </span>
              <span
                className="ml-auto font-mono tabular-nums whitespace-nowrap text-[11px]"
                style={{ color: "#8094b8" }}
              >
                {d.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
