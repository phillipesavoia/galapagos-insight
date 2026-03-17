import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface AllocationSlice {
  asset_class: string;
  weight_pct: number;
}

interface InlineDonutChartProps {
  title: string;
  portfolio: string;
  data: AllocationSlice[];
}

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

export function InlineDonutChart({ title, portfolio, data }: InlineDonutChartProps) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.weight_pct, 0);

  return (
    <div className="my-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
      <h4 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">{title}</h4>
      <p className="text-[11px] text-gray-500 mb-3">{portfolio}</p>
      <div className="flex items-center gap-6">
        <div className="w-[160px] h-[160px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="weight_pct"
                nameKey="asset_class"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {data.map((slice, i) => (
            <div key={slice.asset_class} className="flex items-center gap-2 text-[12px]">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-gray-700 truncate flex-1">{slice.asset_class}</span>
              <span className="text-gray-900 font-semibold tabular-nums">{slice.weight_pct.toFixed(1)}%</span>
            </div>
          ))}
          {total > 0 && (
            <div className="flex items-center gap-2 text-[12px] pt-1 border-t border-gray-200 mt-1">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-transparent" />
              <span className="text-gray-500 font-medium flex-1">Total</span>
              <span className="text-gray-900 font-bold tabular-nums">{total.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
