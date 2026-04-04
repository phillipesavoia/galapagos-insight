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

const COLORS = ["#d4a84b", "#34d399", "#60a5fa", "#f87171", "#a78bfa"];

function formatDateLabel(date: string) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

export default function InlineLineChart({ title, data, lines, yAxisLabel }: InlineLineChartProps) {
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

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}
            axisLine={false}
            tickLine={false}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#64748b",
                    fontSize: 10,
                  }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a1628",
              border: "1px solid rgba(212,168,75,0.4)",
              borderRadius: 10,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
            labelFormatter={formatDateLabel}
            labelStyle={{ color: "#8094b8" }}
            itemStyle={{ color: "#34d399" }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 11,
              color: "#94a3b8",
              paddingTop: 12,
              fontFamily: "'DM Mono', monospace",
            }}
          />
          {lines.map((line, i) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label}
              stroke={line.color || COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
