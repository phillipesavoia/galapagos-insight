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
  "#4ade80", "#3b82f6", "#f97316", "#fb7185", "#8b5cf6",
  "#14b8a6", "#f59e0b", "#ec4899", "#6366f1", "#84cc16",
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[11px] font-mono border border-white/10 backdrop-blur-md"
      style={{ backgroundColor: "#050b18" }}>
      <p className="text-muted-foreground">{payload[0]?.name}</p>
      <p className="text-neon-green font-semibold">{payload[0]?.value?.toFixed(1)}%</p>
    </div>
  );
}

export function InlineDonutChart({ title, portfolio, data }: InlineDonutChartProps) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.weight_pct, 0);

  return (
    <div className="my-3 p-4 rounded-2xl glass-card border border-white/5">
      <h4 className="text-[10px] font-semibold text-neon-orange mb-1 uppercase tracking-widest font-mono">{title}</h4>
      <p className="text-[11px] text-muted-foreground mb-3 font-mono">{portfolio}</p>
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
              <Tooltip content={<CustomTooltip />} />
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
              <span className="text-foreground/70 truncate flex-1">{slice.asset_class}</span>
              <span className="text-foreground font-semibold tabular-nums font-mono">{slice.weight_pct.toFixed(1)}%</span>
            </div>
          ))}
          {total > 0 && (
            <div className="flex items-center gap-2 text-[12px] pt-1 border-t border-white/5 mt-1">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-transparent" />
              <span className="text-muted-foreground font-medium flex-1">Total</span>
              <span className="text-foreground font-bold tabular-nums font-mono">{total.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
