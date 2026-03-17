import { useState } from "react";
import { ClipboardPaste, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PORTFOLIOS = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];

interface ParsedRow {
  date: string;
  portfolio_name: string;
  nav: number;
  valid: boolean;
  error?: string;
}

function parsePastedData(raw: string): ParsedRow[] {
  const lines = raw.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  // Try to detect format:
  // Format A: Date | Model | NAV (3 columns)
  // Format B: Date | Liquidity | Bonds | Conservative | Income | Balanced | Growth (wide)

  const firstLine = lines[0].split(/\t|;|,/).map(s => s.trim());
  const isWideFormat = firstLine.length >= 3 && PORTFOLIOS.some(p =>
    firstLine.some(h => h.toLowerCase() === p.toLowerCase())
  );

  // Check if first line is a header
  const hasHeader = firstLine.some(h =>
    /^(date|data|fecha|modelo|model|portfolio)/i.test(h)
  ) || isWideFormat && PORTFOLIOS.some(p => firstLine.some(h => h.toLowerCase() === p.toLowerCase()));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: ParsedRow[] = [];

  if (isWideFormat) {
    // Map header columns to portfolio names
    const headerCols = lines[0].split(/\t|;|,/).map(s => s.trim());
    const colMap: Record<number, string> = {};
    headerCols.forEach((h, i) => {
      const match = PORTFOLIOS.find(p => p.toLowerCase() === h.toLowerCase());
      if (match) colMap[i] = match;
    });

    for (const line of dataLines) {
      const cols = line.split(/\t|;|,/).map(s => s.trim());
      const dateRaw = cols[0];
      const dateParsed = parseDate(dateRaw);

      for (const [idx, portfolio] of Object.entries(colMap)) {
        const val = cols[Number(idx)];
        if (!val || val === "" || val === "-") continue;
        const nav = parseFloat(val.replace(",", "."));
        const valid = !!dateParsed && !isNaN(nav) && nav > 0;
        rows.push({
          date: dateParsed || dateRaw,
          portfolio_name: portfolio,
          nav: isNaN(nav) ? 0 : nav,
          valid,
          error: !dateParsed ? "Data inválida" : isNaN(nav) || nav <= 0 ? "NAV inválido" : undefined,
        });
      }
    }
  } else {
    // Narrow format: Date | Model | NAV
    for (const line of dataLines) {
      const cols = line.split(/\t|;|,/).map(s => s.trim());
      if (cols.length < 3) {
        rows.push({ date: cols[0] || "", portfolio_name: cols[1] || "", nav: 0, valid: false, error: "Formato inválido (esperado 3 colunas)" });
        continue;
      }
      const dateRaw = cols[0];
      const dateParsed = parseDate(dateRaw);
      const portfolioRaw = cols[1];
      const portfolio = PORTFOLIOS.find(p => p.toLowerCase() === portfolioRaw.toLowerCase());
      const nav = parseFloat(cols[2].replace(",", "."));
      const valid = !!dateParsed && !!portfolio && !isNaN(nav) && nav > 0;
      rows.push({
        date: dateParsed || dateRaw,
        portfolio_name: portfolio || portfolioRaw,
        nav: isNaN(nav) ? 0 : nav,
        valid,
        error: !dateParsed ? "Data inválida" : !portfolio ? "Modelo desconhecido" : isNaN(nav) || nav <= 0 ? "NAV inválido" : undefined,
      });
    }
  }

  return rows;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  // Try ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : raw;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const brMatch = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : iso;
  }
  // Try MM/DD/YYYY
  const usMatch = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (usMatch) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  }
  // Fallback
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

interface BulkPasteNavProps {
  onSaved: () => void;
}

export function BulkPasteNav({ onSaved }: BulkPasteNavProps) {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleParse = () => {
    if (!rawText.trim()) {
      toast.error("Cole os dados na área de texto primeiro");
      return;
    }
    const rows = parsePastedData(rawText);
    if (rows.length === 0) {
      toast.error("Nenhum dado válido encontrado");
      return;
    }
    setPreview(rows);
  };

  const handleSave = async () => {
    if (!preview) return;
    const validRows = preview.filter(r => r.valid);
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para salvar");
      return;
    }

    setSaving(true);
    try {
      const batchSize = 500;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        const { error } = await supabase.from("daily_navs").upsert(
          batch.map(r => ({
            date: r.date,
            portfolio_name: r.portfolio_name,
            nav: r.nav,
          })),
          { onConflict: "date,portfolio_name", ignoreDuplicates: false }
        );
        if (error) {
          console.error("Upsert error:", error);
          for (const r of batch) {
            await supabase.from("daily_navs").upsert(
              { date: r.date, portfolio_name: r.portfolio_name, nav: r.nav },
              { onConflict: "date,portfolio_name", ignoreDuplicates: false }
            );
          }
        }
      }
      toast.success(`${validRows.length} registros salvos com sucesso`);
      setRawText("");
      setPreview(null);
      onSaved();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar dados");
    } finally {
      setSaving(false);
    }
  };

  const invalidCount = preview?.filter(r => !r.valid).length || 0;
  const validCount = preview?.filter(r => r.valid).length || 0;

  return (
    <div className="space-y-4">
      {/* Paste area */}
      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-foreground">Bulk Paste — Colar do Excel / Bloomberg</h3>
        </div>

        <Textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setPreview(null); }}
          placeholder={`Cole os dados aqui. Formatos aceitos:\n\nFormato Largo (Excel):\nDate\tLiquidity\tBonds\tConservative\tIncome\tBalanced\tGrowth\n2025-03-14\t100.50\t98.20\t105.30\t110.00\t115.80\t120.40\n\nFormato Estreito:\n2025-03-14\tBalanced\t115.80\n2025-03-14\tGrowth\t120.40`}
          className="min-h-[160px] font-mono text-xs bg-background"
        />

        <div className="flex items-center gap-3">
          <Button onClick={handleParse} disabled={!rawText.trim()} size="sm" className="gap-2">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Processar Dados Colados
          </Button>
          {rawText && (
            <Button variant="ghost" size="sm" onClick={() => { setRawText(""); setPreview(null); }} className="gap-2 text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-semibold text-foreground">Pré-visualização</h4>
              <span className="text-xs text-muted-foreground">
                {validCount} válidos
                {invalidCount > 0 && (
                  <span className="text-destructive ml-1">· {invalidCount} com erro</span>
                )}
              </span>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || validCount === 0}
              size="sm"
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirmar e Salvar no Banco de Dados
            </Button>
          </div>

          <div className="max-h-[320px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modelo</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">NAV</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i} className={!row.valid ? "bg-destructive/5" : ""}>
                    <TableCell className={`text-sm font-mono ${!row.valid ? "text-destructive" : "text-foreground"}`}>
                      {row.date}
                    </TableCell>
                    <TableCell className={`text-sm ${!row.valid ? "text-destructive" : "text-foreground"}`}>
                      {row.portfolio_name}
                    </TableCell>
                    <TableCell className={`text-sm font-mono text-right ${!row.valid ? "text-destructive" : "text-muted-foreground"}`}>
                      {row.nav > 0 ? row.nav.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell>
                      {row.valid ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-xs text-destructive">{row.error}</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
