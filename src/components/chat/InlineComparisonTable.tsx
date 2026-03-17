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
  if (num > 0) return "text-ares-green";
  if (num < 0) return "text-ares-pink";
  return "";
}

export function InlineComparisonTable({ title, columns, rows, footerRow }: InlineComparisonTableProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="my-3 rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <h4 className="text-xs font-semibold text-ares-orange uppercase tracking-widest">{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-semibold text-ares-orange uppercase tracking-widest ${
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
                className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-secondary/20"}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 font-mono ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    } ${
                      col.key === columns[0]?.key ? "font-semibold text-foreground" : "text-foreground/90"
                    } ${
                      cellColor(row[col.key], col.format)
                    } ${
                      (col.format === "percent" || col.format === "number") ? "font-semibold" : ""
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatCell(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footerRow && (
            <tfoot>
              <tr className="bg-secondary/40 font-bold border-t-2 border-border">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-foreground font-mono ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${cellColor(footerRow[col.key], col.format)}`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
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
