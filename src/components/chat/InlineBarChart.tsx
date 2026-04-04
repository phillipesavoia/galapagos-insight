import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

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

const COLORS = {
  positive: "#4ade80",
  negative: "#fb7185",
  palette: ["#4ade80", "#60a5fa", "#fbbf24", "#fb7185", "#a78bfa", "#2dd4bf", "#fb923c", "#f472b6"],
  axis: "#64748b",
  label: "#cbd5e1",
  grid: "rgba(255,255,255,0.06)",
  bg: "#050a14",
  border: "rgba(255,255,255,0.08)",
  legendBg: "rgba(255,255,255,0.03)",
  legendBorder: "rgba(255,255,255,0.08)",
};

function formatLabel(value: number, suffix: string) {
  if (value == null) return "";
  return `${Number(value).toFixed(2)}${suffix}`;
}

export function InlineBarChart({ title, data, bars, yAxisLabel }: InlineBarChartProps) {
  if (!data || data.length === 0) return null;

  const isSingleBar = bars.length === 1;
  const suffix = yAxisLabel || "";
  const barHeight = isSingleBar ? 28 : 22;
  const rowGap = 14;
  const chartHeight = Math.max(260, data.length * (barHeight + rowGap) + 80);

  return (
    <div
      className="my-5 rounded-2xl border shadow-lg"
      style={{
        background: COLORS.bg,
        borderColor: COLORS.border,
        padding: "20px 24px 16px",
      }}
    >
      <h4
        className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: COLORS.axis }}
      >
        {title}
      </h4>

      <div className="flex gap-5">
        {/* Chart area */}
        <div className="flex-1 min-w-0">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 90, left: 12, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.grid}
                horizontal
                vertical={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: COLORS.axis, fontFamily: "'DM Mono', monospace" }}
                tickFormatter={(v) => `${v}`}
                axisLine={{ stroke: COLORS.grid }}
                tickLine={false}
                label={
                  suffix
                    ? {
                        value: suffix,
                        position: "insideBottomRight",
                        offset: -4,
                        style: { fontSize: 10, fill: COLORS.axis },
                      }
                    : undefined
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{
                  fontSize: 12,
                  fill: COLORS.label,
                  fontWeight: 500,
                }}
                width={140}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.bg,
                  color: "#e2e8f0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  fontFamily: "'DM Mono', monospace",
                }}
                formatter={(value: number, name: string) => [
                  `${Number(value).toFixed(2)}${suffix}`,
                  name,
                ]}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {bars.map((bar, idx) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.label}
                  fill={bar.color || COLORS.palette[idx % COLORS.palette.length]}
                  radius={[0, 5, 5, 0]}
                  barSize={barHeight}
                >
                  <LabelList
                    dataKey={bar.dataKey}
                    position="right"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: COLORS.label,
                      fontFamily: "'DM Mono', monospace",
                    }}
                    formatter={(v: number) => formatLabel(v, suffix)}
                  />
                  {isSingleBar &&
                    data.map((entry, i) => {
                      const val = entry[bar.dataKey];
                      return (
                        <Cell
                          key={i}
                          fill={val < 0 ? COLORS.negative : COLORS.positive}
                          fillOpacity={0.9}
                        />
                      );
                    })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div
          className="shrink-0 w-52 rounded-xl p-3.5 flex flex-col gap-2 self-start max-h-[420px] overflow-y-auto"
          style={{
            background: COLORS.legendBg,
            border: `1px solid ${COLORS.legendBorder}`,
          }}
        >
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.2em] mb-1"
            style={{ color: COLORS.axis }}
          >
            Legenda
          </span>
          {(isSingleBar
            ? data.map((entry, i) => ({
                name: entry.name as string,
                color: (entry[bars[0].dataKey] as number) < 0 ? COLORS.negative : COLORS.positive,
                value: entry[bars[0].dataKey] as number,
              }))
            : bars.map((bar, idx) => ({
                name: bar.label,
                color: bar.color || COLORS.palette[idx % COLORS.palette.length],
                value: null as number | null,
              }))
          ).map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm shrink-0 mt-[3px]"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] leading-tight break-words flex-1 min-w-0" style={{ color: COLORS.label }}>
                {item.name}
              </span>
              {item.value != null && (
                <span className="shrink-0 text-[10px] font-mono whitespace-nowrap" style={{ color: COLORS.axis }}>
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
