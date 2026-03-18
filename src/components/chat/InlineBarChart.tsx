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
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316",
];

function formatLabel(value: number, suffix: string) {
  if (value == null) return "";
  return `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)}${suffix}`;
}

export function InlineBarChart({ title, data, bars, yAxisLabel }: InlineBarChartProps) {
  if (!data || data.length === 0) return null;

  const isSingleBar = bars.length === 1;
  const suffix = yAxisLabel || "";

  return (
    <div className="my-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
      <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">{title}</h4>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40 + 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) => `${v}${suffix}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#374151", fontWeight: 500 }}
            width={120}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(value: number, name: string) => [`${value}${suffix}`, name]}
          />
          {bars.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11 }}
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
                style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }}
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
