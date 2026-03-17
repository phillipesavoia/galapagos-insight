interface ColumnDef {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "percent" | "number" | "text";
}

interface InlineComparisonTableProps {
  title: string;
  columns: ColumnDef[];
  rows: Record<string, any>[];
  footerRow?: Record<string, any>;
}

function formatCell(value: any, format?: string): string {
  if (value == null || value === "") return "—";
  if (format === "percent") {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
  }
  if (format === "number") {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return num.toFixed(2);
  }
  return String(value);
}

function cellColor(value: any, format?: string): string {
  if (format !== "percent" && format !== "number") return "";
  const num = Number(value);
  if (isNaN(num)) return "";
  if (num > 0) return "text-emerald-600";
  if (num < 0) return "text-red-500";
  return "text-muted-foreground";
}

export function InlineComparisonTable({ title, columns, rows, footerRow }: InlineComparisonTableProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="my-3 rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/20">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-medium text-muted-foreground uppercase tracking-wider ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/40 hover:bg-accent/5 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 font-variant-numeric-tabular ${
                      col.align === "right" ? "text-right font-mono" : col.align === "center" ? "text-center" : "text-left"
                    } ${
                      col.key === columns[0]?.key ? "font-semibold text-foreground" : ""
                    } ${cellColor(row[col.key], col.format)}`}
                    style={{ fontVariantNumeric: col.align === "right" ? "tabular-nums" : undefined }}
                  >
                    {formatCell(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footerRow && (
            <tfoot>
              <tr className="bg-secondary/40 font-semibold border-t border-border">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 ${
                      col.align === "right" ? "text-right font-mono" : "text-left"
                    } ${cellColor(footerRow[col.key], col.format)}`}
                    style={{ fontVariantNumeric: col.align === "right" ? "tabular-nums" : undefined }}
                  >
                    {formatCell(footerRow[col.key], col.format)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
