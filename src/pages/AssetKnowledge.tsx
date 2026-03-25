import { useState, useEffect, useCallback, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, BookOpen, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle, UploadCloud, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Asset {
  id: string;
  ticker: string;
  isin: string;
  name: string;
  asset_class: string;
  official_thesis: string;
  risk_profile: string;
  portfolios: string[];
  weight_pct: Record<string, number>;
  amc_parent: string | null;
}

interface ParsedRow {
  portfolio: string;
  ticker: string;
  isin: string;
  name: string;
  asset_class: string;
  weight: number;
  thesis: string;
  valid: boolean;
  error?: string;
}

const PORTFOLIO_OPTIONS = ["Conservative", "Income", "Balanced", "Growth", "Bond Portfolio", "Liquidity"];

const ASSET_CLASSES = [
  "Fixed Income", "Equities", "Alternatives", "Commodities",
  "Cash & Equivalents", "Real Estate", "Private Credit", "Crypto",
];
const RISK_PROFILES = ["Conservative", "Moderate", "Aggressive"];

const emptyAsset = { ticker: "", isin: "", name: "", asset_class: "Fixed Income", official_thesis: "", risk_profile: "Moderate" };

// Normalize header names to match expected columns
function normalizeHeader(h: string): string {
  const s = h.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const map: Record<string, string> = {
    portfolio: "portfolio", modelo: "portfolio", model: "portfolio", portf_lio: "portfolio",
    ticker: "ticker", symbol: "ticker", s_mbolo: "ticker",
    isin: "isin",
    nome: "name", name: "name", ativo: "name", asset: "name", fund: "name", fundo: "name", nome_do_ativo: "name", asset_name: "name",
    asset_class: "asset_class", classe: "asset_class", class: "asset_class", classe_do_ativo: "asset_class", tipo: "asset_class",
    peso: "weight", weight: "weight", peso___: "weight", weight___: "weight", aloca__o: "weight", allocation: "weight", peso____: "weight", weight____: "weight",
    tese: "thesis", thesis: "thesis", tese_da_gest_o: "thesis", official_thesis: "thesis", coment_rio: "thesis", comment: "thesis",
    risk_profile: "risk_profile", perfil_de_risco: "risk_profile", risco: "risk_profile",
  };
  return map[s] || s;
}

function inferAssetClass(name: string, ticker: string): string {
  const combined = `${name} ${ticker}`.toLowerCase();
  if (/bond|treasury|credit|income|yield|duration|tips|mbs|bil|shy|ief|tlt|hyg|lqd|bnd|agg|emb|vcsh/i.test(combined)) return "Fixed Income";
  if (/equity|stock|spy|qqq|iwm|eem|vti|vwo|growth|value|dividend/i.test(combined)) return "Equities";
  if (/gold|silver|commodity|oil|gld|slv|dba|dbc/i.test(combined)) return "Commodities";
  if (/real estate|reit|vnq|ire/i.test(combined)) return "Real Estate";
  if (/alternative|hedge|private|arbitr/i.test(combined)) return "Alternatives";
  if (/cash|money market|liquidity|savings/i.test(combined)) return "Cash & Equivalents";
  return "Fixed Income";
}

export default function AssetKnowledge() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyAsset);

  // Bulk import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [droppedFileName, setDroppedFileName] = useState("");
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [view, setView] = useState<"cards" | "matriz">("cards");
  const [referenceDate, setReferenceDate] = useState<Date | undefined>(undefined);

  const fetchAssets = async () => {
    const { data } = await supabase.from("asset_knowledge").select("*").order("ticker");
    setAssets((data as unknown as Asset[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAssets(); }, []);

  // --- Single asset CRUD ---
  const openNew = () => { setEditing(null); setForm(emptyAsset); setDialogOpen(true); };
  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({ ticker: a.ticker, isin: a.isin || "", name: a.name, asset_class: a.asset_class, official_thesis: a.official_thesis, risk_profile: a.risk_profile });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.ticker || !form.name) { toast.error("Ticker e nome são obrigatórios"); return; }
    const payload = {
      ticker: form.ticker.toUpperCase(),
      isin: form.isin ? form.isin.toUpperCase() : null,
      name: form.name,
      asset_class: form.asset_class,
      official_thesis: form.official_thesis,
      risk_profile: form.risk_profile,
    } as any;

    if (editing) {
      const { error } = await supabase.from("asset_knowledge").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Ativo atualizado");
    } else {
      const { error } = await supabase.from("asset_knowledge").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Ativo cadastrado");
    }
    setDialogOpen(false);
    fetchAssets();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    await supabase.from("asset_knowledge").delete().eq("id", id);
    toast.success("Ativo excluído");
    fetchAssets();
  };

  // --- Bulk file parsing (Bloomberg-compatible) ---
  const parseFile = useCallback((file: File) => {
    if (!selectedPortfolio) {
      toast.error("Selecione um portfólio antes de importar");
      return;
    }
    if (!referenceDate) {
      toast.error("Selecione a Data Base (Reference Date) antes de importar");
      return;
    }
    setDroppedFileName(file.name);
    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows: string[][] = [];

        if (isExcel) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
        } else {
          const text = e.target?.result as string;
          const workbook = XLSX.read(text, { type: "string" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
        }

        if (rows.length === 0) { toast.error("Arquivo vazio"); return; }

        // --- Bloomberg detection: find the header row containing "PK" ---
        let headerRowIndex = -1;
        let isBloomberg = false;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const firstCell = String(rows[i][0] || "").trim().toUpperCase();
          if (firstCell === "PK") {
            headerRowIndex = i;
            isBloomberg = true;
            break;
          }
        }

        let parsed: ParsedRow[] = [];

        if (isBloomberg) {
          // Bloomberg format: PK, Descr, ISIN, Weight (+ possibly other cols)
          const headers = rows[headerRowIndex].map((h) => String(h).trim().toUpperCase());
          const pkIdx = headers.indexOf("PK");
          const descrIdx = headers.findIndex((h) => h.startsWith("DESCR") || h === "NAME" || h === "NOME");
          const isinIdx = headers.indexOf("ISIN");
          const weightIdx = headers.findIndex((h) => h === "WEIGHT" || h === "PESO" || h.includes("WEIGHT") || h.includes("PESO"));

          const dataRows = rows.slice(headerRowIndex + 1);

          parsed = dataRows
            .map((row) => {
              const ticker = String(row[pkIdx] || "").trim().toUpperCase();
              // Filter junk rows
              if (!ticker || ticker === "<SEARCH>" || ticker === "TOTALS" || ticker === "TOTAL") {
                return null;
              }
              const name = String(row[descrIdx >= 0 ? descrIdx : 1] || "").trim();
              const isin = String(row[isinIdx >= 0 ? isinIdx : 2] || "").trim().toUpperCase();

              let weight = 0;
              if (weightIdx >= 0) {
                const rawWeight = String(row[weightIdx] || "").replace(/[%\s]/g, "").replace(",", ".");
                if (rawWeight) {
                  const p = parseFloat(rawWeight);
                  if (!isNaN(p)) weight = p > 1 ? p : p * 100;
                }
              }

              const asset_class = inferAssetClass(name, ticker);
              let valid = true;
              let error: string | undefined;
              if (!ticker) { valid = false; error = "Ticker vazio"; }

              return {
                portfolio: selectedPortfolio,
                ticker,
                isin: isin.length === 12 ? isin : "",
                name: name || ticker,
                asset_class,
                weight,
                thesis: "",
                valid,
                error,
              } as ParsedRow;
            })
            .filter(Boolean) as ParsedRow[];

          toast.info(`Formato Bloomberg detectado — ${parsed.length} linhas lidas`);
        } else {
          // Legacy / generic format: use normalized headers from first row
          const rawHeaders = rows[0].map((h) => String(h));
          const headerMap: Record<number, string> = {};
          rawHeaders.forEach((h, idx) => { headerMap[idx] = normalizeHeader(h); });

          const dataRows = rows.slice(1);
          parsed = dataRows
            .map((row) => {
              const mapped: Record<string, string> = {};
              row.forEach((v, idx) => {
                const key = headerMap[idx];
                if (key) mapped[key] = String(v).trim();
              });

              const ticker = (mapped.ticker || "").toUpperCase().slice(0, 20);
              const isin = (mapped.isin || "").toUpperCase().slice(0, 12);
              const name = (mapped.name || "").slice(0, 200);
              const rawClass = mapped.asset_class || "";
              const asset_class = ASSET_CLASSES.find((c) => c.toLowerCase() === rawClass.toLowerCase()) || inferAssetClass(name, ticker);
              const thesis = (mapped.thesis || "").slice(0, 5000);

              let weight = 0;
              const rawWeight = (mapped.weight || "").replace(/[%\s]/g, "").replace(",", ".");
              if (rawWeight) {
                const p = parseFloat(rawWeight);
                if (!isNaN(p)) weight = p > 1 ? p : p * 100;
              }

              let valid = true;
              let error: string | undefined;
              if (!ticker && !name) { valid = false; error = "Ticker e nome vazios"; }
              else if (!ticker) { valid = false; error = "Ticker obrigatório"; }

              return {
                portfolio: mapped.portfolio || selectedPortfolio,
                ticker, isin, name: name || ticker, asset_class, weight, thesis, valid, error,
              } as ParsedRow;
            })
            .filter((r) => r.ticker || r.name);
        }

        setParsedRows(parsed);
        setImportDialogOpen(true);
      } catch (err) {
        console.error("Parse error:", err);
        toast.error("Erro ao ler arquivo. Verifique o formato.");
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }, [selectedPortfolio, referenceDate]);

  // Dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files[0]) parseFile(files[0]); },
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // --- Bulk upsert logic ---
  const handleBulkImport = async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) { toast.error("Nenhuma linha válida"); return; }

    setImporting(true);
    setImportProgress(0);

    // Group by ticker to merge portfolio info
    const tickerMap = new Map<string, {
      ticker: string; isin: string; name: string; asset_class: string;
      thesis: string; portfolios: Set<string>; weights: Record<string, number>;
    }>();

    for (const row of validRows) {
      const existing = tickerMap.get(row.ticker);
      if (existing) {
        if (row.portfolio) existing.portfolios.add(row.portfolio);
        if (row.portfolio && row.weight > 0) existing.weights[row.portfolio] = row.weight;
        if (row.isin && !existing.isin) existing.isin = row.isin;
        if (row.thesis && !existing.thesis) existing.thesis = row.thesis;
      } else {
        const portfolios = new Set<string>();
        const weights: Record<string, number> = {};
        if (row.portfolio) { portfolios.add(row.portfolio); if (row.weight > 0) weights[row.portfolio] = row.weight; }
        tickerMap.set(row.ticker, {
          ticker: row.ticker, isin: row.isin, name: row.name,
          asset_class: row.asset_class, thesis: row.thesis,
          portfolios, weights,
        });
      }
    }

    const entries = Array.from(tickerMap.values());
    const existingTickers = new Set(assets.map((a) => a.ticker.toUpperCase()));
    // Also fetch existing data to merge portfolios
    const { data: existingData } = await supabase.from("asset_knowledge").select("ticker, portfolios, weight_pct");
    const existingMap = new Map<string, { portfolios: string[]; weight_pct: Record<string, number> }>();
    if (existingData) {
      for (const row of existingData as any[]) {
        existingMap.set(row.ticker, { portfolios: row.portfolios || [], weight_pct: row.weight_pct || {} });
      }
    }

    let inserted = 0, updated = 0, errors = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Merge with existing portfolios/weights
      const existing = existingMap.get(entry.ticker);
      const mergedPortfolios = [...new Set([...(existing?.portfolios || []), ...entry.portfolios])];
      const mergedWeights = { ...(existing?.weight_pct || {}), ...entry.weights };

      const payload = {
        ticker: entry.ticker,
        isin: entry.isin || null,
        name: entry.name,
        asset_class: entry.asset_class,
        official_thesis: entry.thesis || undefined,
        portfolios: mergedPortfolios,
        weight_pct: mergedWeights,
        as_of_date: referenceDate ? format(referenceDate, "yyyy-MM-dd") : null,
        updated_at: new Date().toISOString(),
      } as any;

      if (existingTickers.has(entry.ticker)) {
        // Don't overwrite thesis if new one is empty
        if (!entry.thesis) delete payload.official_thesis;
        const { error } = await supabase.from("asset_knowledge").update(payload).eq("ticker", entry.ticker);
        if (error) { errors++; console.error(`Update error for ${entry.ticker}:`, error); } else { updated++; }
      } else {
        if (!payload.official_thesis) payload.official_thesis = "";
        payload.risk_profile = "Moderate";
        const { error } = await supabase.from("asset_knowledge").insert(payload);
        if (error) { errors++; console.error(`Insert error for ${entry.ticker}:`, error); } else { inserted++; }
      }

      setImportProgress(Math.round(((i + 1) / entries.length) * 100));
    }

    setImporting(false);
    setImportDialogOpen(false);
    setParsedRows([]);

    const parts: string[] = [];
    if (inserted > 0) parts.push(`${inserted} inserido(s)`);
    if (updated > 0) parts.push(`${updated} atualizado(s)`);
    if (errors > 0) parts.push(`${errors} erro(s)`);
    toast.success(`Importação concluída: ${parts.join(", ")}`);
    fetchAssets();
  };

  // AMC groups for matrix view
  const amcGroups = useMemo(() => {
    const amcAssets = assets.filter(a =>
      !a.amc_parent &&
      Object.keys(a.weight_pct || {}).length > 0 &&
      assets.some(child => child.amc_parent === a.ticker)
    );
    return amcAssets.map(amc => ({
      amc,
      children: assets
        .filter(child => child.amc_parent === amc.ticker)
        .sort((a, b) => {
          const wa = Math.max(...PORTFOLIO_OPTIONS.map(p => (a.weight_pct as any)?.[p] ?? 0));
          const wb = Math.max(...PORTFOLIO_OPTIONS.map(p => (b.weight_pct as any)?.[p] ?? 0));
          return wb - wa;
        }),
    }));
  }, [assets]);

  // Direct assets: no amc_parent, has weight, not AMCs
  const directAssets = useMemo(() => {
    const amcTickers = new Set(amcGroups.map(g => g.amc.ticker));
    return assets.filter(a =>
      !a.amc_parent &&
      !amcTickers.has(a.ticker) &&
      Object.values(a.weight_pct || {}).some(v => (v as number) > 0)
    );
  }, [assets, amcGroups]);

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;
  const uniqueTickers = new Set(parsedRows.filter((r) => r.valid).map((r) => r.ticker)).size;
  const detectedPortfolios = [...new Set(parsedRows.filter((r) => r.valid && r.portfolio).map((r) => r.portfolio))];

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Asset Dictionary</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Ativo
            </Button>
          </div>
        </div>

        {/* Portfolio selector + Reference Date + Dropzone */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-foreground whitespace-nowrap">Selecionar Portfólio *</label>
            <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Escolha o portfólio..." />
              </SelectTrigger>
              <SelectContent>
                {PORTFOLIO_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium text-foreground whitespace-nowrap ml-4">Reference Date (Data Base) *</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !referenceDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {referenceDate ? format(referenceDate, "MM/yyyy") : <span>Selecionar mês...</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={referenceDate}
                  onSelect={setReferenceDate}
                  className={cn("p-3 pointer-events-auto")}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              !selectedPortfolio || !referenceDate ? "opacity-50 pointer-events-none" : ""
            } ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`h-10 w-10 mx-auto mb-3 ${isDragActive ? "text-primary" : "text-muted-foreground/50"}`} />
            <p className="text-sm font-medium text-foreground">
              {isDragActive ? "Solte o arquivo aqui..." : "Arraste o CSV do Bloomberg ou planilha aqui"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV, XLSX, XLS — Detecta automaticamente formato Bloomberg (PK, Descr, ISIN, Weight)
            </p>
            {!selectedPortfolio && (
              <p className="text-xs text-destructive mt-1 font-medium">
                ⚠ Selecione um portfólio acima antes de importar
              </p>
            )}
          </div>
        </div>

        {/* Assets table */}
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum ativo cadastrado. Faça upload das planilhas dos modelos acima.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ticker</TableHead>
                  <TableHead className="w-[130px]">ISIN</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[120px]">Classe</TableHead>
                  <TableHead>Portfólios</TableHead>
                  <TableHead className="w-[70px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-semibold text-primary">{a.ticker}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.isin || "—"}</TableCell>
                    <TableCell className="text-sm">{a.name}</TableCell>
                    <TableCell className="text-xs">{a.asset_class}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(a.portfolios || []).map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {p}{a.weight_pct?.[p] ? ` ${a.weight_pct[p]}%` : ""}
                          </Badge>
                        ))}
                        {(!a.portfolios || a.portfolios.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Single edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Ativo" : "Novo Ativo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Identificadores (Golden Source)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Ticker *</label>
                    <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="Ex: HYG" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">ISIN</label>
                    <Input value={form.isin} onChange={(e) => setForm({ ...form, isin: e.target.value })} placeholder="Ex: US4642885135" className="font-mono" maxLength={12} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: iShares High Yield Corp Bond ETF" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Classe do Ativo</label>
                  <Select value={form.asset_class} onValueChange={(v) => setForm({ ...form, asset_class: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ASSET_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Perfil de Risco</label>
                  <Select value={form.risk_profile} onValueChange={(v) => setForm({ ...form, risk_profile: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RISK_PROFILES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tese Oficial da Gestão</label>
                <Textarea value={form.official_thesis} onChange={(e) => setForm({ ...form, official_thesis: e.target.value })} placeholder="Descreva a tese oficial..." rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk import preview dialog */}
        <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!importing) { setImportDialogOpen(open); if (!open) setParsedRows([]); } }}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Preview — {droppedFileName}
              </DialogTitle>
            </DialogHeader>

            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {validCount} linha(s) válida(s)
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-4 w-4" /> {invalidCount} inválida(s)
                </span>
              )}
              <span className="text-muted-foreground">→ {uniqueTickers} ativo(s) único(s)</span>
              {detectedPortfolios.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">Portfólios:</span>
                  {detectedPortfolios.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Progress bar during import */}
            {importing && (
              <div className="space-y-1.5">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{importProgress}% concluído</p>
              </div>
            )}

            {/* Data preview table */}
            <div className="flex-1 overflow-auto border rounded-lg min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35px]" />
                    <TableHead className="w-[90px]">Portfolio</TableHead>
                    <TableHead className="w-[75px]">Ticker</TableHead>
                    <TableHead className="w-[110px]">ISIN</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[110px]">Classe</TableHead>
                    <TableHead className="w-[65px]">Peso</TableHead>
                    <TableHead>Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i} className={!row.valid ? "opacity-40" : ""}>
                      <TableCell>
                        {row.valid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-xs">{row.portfolio || "—"}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{row.ticker}</TableCell>
                      <TableCell className="font-mono text-[10px]">{row.isin || "—"}</TableCell>
                      <TableCell className="text-xs">{row.name}</TableCell>
                      <TableCell className="text-[10px]">{row.asset_class}</TableCell>
                      <TableCell className="text-xs font-mono">{row.weight > 0 ? `${row.weight}%` : "—"}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{row.error || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setImportDialogOpen(false); setParsedRows([]); }} disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={handleBulkImport} disabled={importing || validCount === 0} className="gap-2">
                {importing ? "Importando..." : `Importar ${uniqueTickers} ativo(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
