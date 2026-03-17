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

function cellColor(_value: any, _format?: string): string {
  // Institutional B&W — no color coding
  return "";
}

export function InlineComparisonTable({ title, columns, rows, footerRow }: InlineComparisonTableProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="my-3 rounded-lg border border-foreground/20 bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-foreground/20 bg-foreground/5">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-foreground/20 bg-foreground/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-semibold text-foreground uppercase tracking-wider ${
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
                className={`border-b border-foreground/10 ${i % 2 === 0 ? "" : "bg-foreground/[0.03]"}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 ${
                      col.align === "right" ? "text-right font-mono" : col.align === "center" ? "text-center" : "text-left"
                    } ${
                      col.key === columns[0]?.key ? "font-semibold text-foreground" : "text-foreground/90"
                    } ${
                      (col.format === "percent" || col.format === "number") ? "font-semibold" : ""
                    }`}
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
              <tr className="bg-foreground/[0.07] font-bold border-t-2 border-foreground/20">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-foreground ${
                      col.align === "right" ? "text-right font-mono" : "text-left"
                    }`}
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
