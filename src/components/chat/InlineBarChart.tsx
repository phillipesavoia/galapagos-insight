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
  "#4ade80", "#60a5fa", "#fbbf24", "#fb7185", "#a78bfa",
  "#f472b6", "#2dd4bf", "#fb923c",
];

function formatLabel(value: number, suffix: string) {
  if (value == null) return "";
  // For weight/allocation data (no sign needed), only add +/- for return-like metrics
  const num = Number(value);
  return `${num.toFixed(2)}${suffix}`;
}

export function InlineBarChart({ title, data, bars, yAxisLabel }: InlineBarChartProps) {
  if (!data || data.length === 0) return null;

  const isSingleBar = bars.length === 1;
  const suffix = yAxisLabel || "";
  const barHeight = isSingleBar ? 32 : 24;
  const chartHeight = Math.max(220, data.length * (barHeight + 20) + 80);

  // Build legend items for single-bar mode (each data point is a color)
  const legendItems = isSingleBar
    ? data.map((entry, i) => ({
        name: entry.name as string,
        color: (entry[bars[0].dataKey] as number) < 0 ? DEFAULT_COLORS[3] : DEFAULT_COLORS[0],
        value: entry[bars[0].dataKey] as number,
      }))
    : bars.map((bar, idx) => ({
        name: bar.label,
        color: bar.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        value: null as number | null,
      }));

  return (
    <div className="my-4 p-5 rounded-2xl bg-[#050b18] border border-white/10 backdrop-blur-md shadow-lg">
      <h4 className="text-[11px] font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
        {title}
      </h4>
      <div className="flex gap-4">
        {/* Chart */}
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#64748b", fontFamily: "monospace" }}
                tickFormatter={(v) => `${v}`}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                label={suffix ? { value: suffix, position: "insideBottomRight", offset: -4, style: { fontSize: 10, fill: "#64748b" } } : undefined}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                width={110}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  backgroundColor: "#050b18",
                  color: "#e2e8f0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value: number, name: string) => [`${Number(value).toFixed(2)}${suffix}`, name]}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {bars.map((bar, idx) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.label}
                  fill={bar.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                  radius={[0, 6, 6, 0]}
                  barSize={barHeight}
                >
                  <LabelList
                    dataKey={bar.dataKey}
                    position="right"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: "#e2e8f0",
                      fontFamily: "monospace",
                    }}
                    formatter={(v: number) => formatLabel(v, suffix)}
                  />
                  {isSingleBar && data.map((entry, i) => {
                    const val = entry[bar.dataKey];
                    const color = val < 0
                      ? DEFAULT_COLORS[3]
                      : DEFAULT_COLORS[0];
                    return (
                      <Cell
                        key={i}
                        fill={color}
                        fillOpacity={0.85}
                      />
                    );
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend panel */}
        <div className="shrink-0 w-40 rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-1.5 self-start">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Legenda</span>
          {legendItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-slate-300 truncate">{item.name}</span>
              {item.value != null && (
                <span className="ml-auto text-[10px] font-mono text-slate-400">
                  {formatLabel(item.value, suffix)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
