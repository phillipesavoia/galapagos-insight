import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface InlineLineChartProps {
  title: string;
  data: Array<{ date: string; [key: string]: number | string }>;
  lines: Array<{ dataKey: string; label: string; color?: string }>;
  yAxisLabel?: string;
}

const DEFAULT_COLORS = ["#d4a84b", "#34d399", "#60a5fa", "#f87171", "#a78bfa"];

function formatDateLabel(date: string) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export default function InlineLineChart({ title, data, lines, yAxisLabel }: InlineLineChartProps) {
  return (
    <div className="my-3 rounded-xl border border-white/[0.08] bg-[#0f1525] p-4">
      <p className="mb-3 text-[13px] font-semibold text-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke="#1a2540" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: "#4f5e7a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#4f5e7a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", fill: "#4f5e7a", fontSize: 10 } : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0d1b3e",
              border: "1px solid #d4a84b",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 11,
            }}
            labelFormatter={formatDateLabel}
            labelStyle={{ color: "#8094b8" }}
            itemStyle={{ color: "#34d399" }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: 11, color: "#8094b8", paddingTop: 8 }}
          />
          {lines.map((line, i) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label}
              stroke={line.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
