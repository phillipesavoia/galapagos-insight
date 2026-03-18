import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";

interface BarDef {
  dataKey: string;
  label: string;
  color?: string;
}

interface InlineBarChartProps {
  title: string;
  data: Record<string, any>[];
  bars: BarDef[];
  yAxisLabel?: string;
}

const DEFAULT_COLORS = [
  "#4ade80", "#3b82f6", "#f97316", "#fb7185", "#8b5cf6",
  "#14b8a6", "#f59e0b", "#ec4899",
];

function formatLabel(value: number, suffix: string) {
  if (value == null) return "";
  return `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)}${suffix}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[11px] font-mono border border-white/10 backdrop-blur-md"
      style={{ backgroundColor: "#050b18" }}>
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}{p.unit || ""}
        </p>
      ))}
    </div>
  );
}

export function InlineBarChart({ title, data, bars, yAxisLabel }: InlineBarChartProps) {
  if (!data || data.length === 0) return null;

  const isSingleBar = bars.length === 1;
  const suffix = yAxisLabel || "";

  return (
    <div className="my-3 p-4 rounded-2xl glass-card border border-white/5">
      <h4 className="text-[10px] font-semibold text-neon-orange mb-3 uppercase tracking-widest font-mono">{title}</h4>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40 + 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            horizontal={false}
            vertical={true}
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#475569", fontFamily: "JetBrains Mono, monospace" }}
            tickFormatter={(v) => `${v}${suffix}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} />
          {bars.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              iconType="circle"
            />
          )}
          {bars.map((bar, idx) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.label}
              fill={bar.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
              radius={[0, 4, 4, 0]}
              barSize={isSingleBar ? 20 : undefined}
            >
              <LabelList
                dataKey={bar.dataKey}
                position="right"
                style={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8", fontFamily: "JetBrains Mono, monospace" }}
                formatter={(v: number) => formatLabel(v, suffix)}
              />
              {isSingleBar && data.map((_, i) => (
                <Cell
                  key={i}
                  fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
