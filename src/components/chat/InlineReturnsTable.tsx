interface InlineReturnsTableProps {
  title: string;
  columns: string[];
  rows: Array<{ label: string; [key: string]: number | string }>;
  colorize?: boolean;
}

function formatCell(value: unknown, colorize: boolean): { text: string; className: string } {
  if (value === null || value === undefined) return { text: "—", className: "text-[#8094b8]" };
  if (typeof value === "string") return { text: value, className: "text-foreground" };
  if (typeof value === "number") {
    const text = value >= -100 && value <= 100 ? `${value.toFixed(2)}%` : String(value);
    if (!colorize) return { text, className: "text-foreground" };
    if (value > 0) return { text, className: "text-[#34d399] font-medium" };
    if (value < 0) return { text, className: "text-[#f87171] font-medium" };
    return { text, className: "text-[#8094b8]" };
  }
  return { text: String(value), className: "text-foreground" };
}

export default function InlineReturnsTable({ title, columns, rows, colorize = false }: InlineReturnsTableProps) {
  return (
    <div className="my-3 rounded-xl border border-white/[0.08] bg-[#0f1525] p-4">
      <p className="mb-3 text-[13px] font-semibold text-foreground">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#162040]">
              <th className="sticky left-0 z-10 bg-[#162040] px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d4a84b] whitespace-nowrap">
                &nbsp;
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((row, i) => (
              <tr key={i} className="transition-colors hover:bg-white/[0.03]">
                <td className="sticky left-0 z-10 bg-[#0f1525] px-3 py-1.5 font-mono text-[11px] font-bold text-[#d4a84b] whitespace-nowrap">
                  {row.label}
                </td>
                {columns.map((col) => {
                  const { text, className } = formatCell(row[col], colorize);
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 text-right font-mono text-[11px] tabular-nums whitespace-nowrap ${className}`}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
