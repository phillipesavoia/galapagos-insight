import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, BookOpen, Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Asset {
  id: string;
  ticker: string;
  isin: string;
  name: string;
  asset_class: string;
  official_thesis: string;
  risk_profile: string;
}

interface CsvRow {
  ticker: string;
  isin: string;
  name: string;
  asset_class: string;
  official_thesis: string;
  risk_profile: string;
  valid: boolean;
  error?: string;
}

const ASSET_CLASSES = [
  "Fixed Income",
  "Equities",
  "Alternatives",
  "Commodities",
  "Cash & Equivalents",
  "Real Estate",
  "Private Credit",
  "Crypto",
];

const RISK_PROFILES = ["Conservative", "Moderate", "Aggressive"];

const emptyAsset = { ticker: "", isin: "", name: "", asset_class: "Fixed Income", official_thesis: "", risk_profile: "Moderate" };

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function validateRow(row: CsvRow, existingTickers: Set<string>, seenTickers: Set<string>): CsvRow {
  if (!row.ticker) return { ...row, valid: false, error: "Ticker obrigatório" };
  if (!row.name) return { ...row, valid: false, error: "Nome obrigatório" };
  if (row.ticker.length > 20) return { ...row, valid: false, error: "Ticker muito longo" };
  if (row.name.length > 200) return { ...row, valid: false, error: "Nome muito longo" };
  if (row.isin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(row.isin)) return { ...row, valid: false, error: "ISIN inválido (formato: XX0000000000)" };
  if (row.official_thesis.length > 5000) return { ...row, valid: false, error: "Tese muito longa (max 5000)" };
  if (seenTickers.has(row.ticker)) return { ...row, valid: false, error: "Ticker duplicado no CSV" };
  const isDuplicate = existingTickers.has(row.ticker);
  seenTickers.add(row.ticker);
  return { ...row, valid: true, error: isDuplicate ? "Será atualizado (já existe)" : undefined };
}

export default function AssetKnowledge() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyAsset);

  // CSV import state
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    const { data } = await supabase.from("asset_knowledge").select("*").order("ticker");
    setAssets((data as unknown as Asset[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAssets(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyAsset); setDialogOpen(true); };
  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({ ticker: a.ticker, isin: a.isin || "", name: a.name, asset_class: a.asset_class, official_thesis: a.official_thesis, risk_profile: a.risk_profile });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.ticker || !form.name) { toast.error("Ticker e nome são obrigatórios"); return; }
    if (form.isin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(form.isin.toUpperCase())) {
      toast.error("ISIN inválido. Formato esperado: 12 caracteres (ex: US4642874659)");
      return;
    }
    const payload = {
      ticker: form.ticker.toUpperCase(),
      isin: form.isin ? form.isin.toUpperCase() : null,
      name: form.name,
      asset_class: form.asset_class,
      official_thesis: form.official_thesis,
      risk_profile: form.risk_profile,
    } as any;

    if (editing) {
      const { error } = await supabase.from("asset_knowledge").update({
        ...payload,
        updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Ativo atualizado");
    } else {
      const { error } = await supabase.from("asset_knowledge").insert(payload);
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success("Ativo cadastrado");
    }
    setDialogOpen(false);
    fetchAssets();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este ativo?")) return;
    const { error } = await supabase.from("asset_knowledge").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Ativo excluído");
    fetchAssets();
  };

  const handleDownloadTemplate = () => {
    const header = "ticker,isin,name,asset_class,risk_profile,official_thesis";
    const example = 'HYG,US4642885135,"iShares High Yield Corp Bond",Fixed Income,Moderate,"Exposição a crédito high yield americano para capturar spread em ambiente de soft landing."';
    const blob = new Blob([header + "\n" + example + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asset_knowledge_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Apenas arquivos .csv são aceitos"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande (max 2MB)"); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV vazio ou sem dados"); return; }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
      const tickerIdx = header.indexOf("ticker");
      const isinIdx = header.indexOf("isin");
      const nameIdx = header.indexOf("name");
      const classIdx = header.indexOf("asset_class");
      const riskIdx = header.indexOf("risk_profile");
      const thesisIdx = header.indexOf("official_thesis");

      if (tickerIdx === -1 || nameIdx === -1) {
        toast.error("CSV deve conter colunas 'ticker' e 'name'");
        return;
      }

      const existingTickers = new Set(assets.map((a) => a.ticker.toUpperCase()));
      const seenTickers = new Set<string>();

      const rows: CsvRow[] = lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        const ticker = (cols[tickerIdx] || "").toUpperCase().slice(0, 20);
        const isin = isinIdx >= 0 ? (cols[isinIdx] || "").toUpperCase().slice(0, 12) : "";
        const name = (cols[nameIdx] || "").slice(0, 200);
        const rawClass = classIdx >= 0 ? cols[classIdx] || "" : "";
        const asset_class = ASSET_CLASSES.find((c) => c.toLowerCase() === rawClass.toLowerCase()) || "Fixed Income";
        const rawRisk = riskIdx >= 0 ? cols[riskIdx] || "" : "";
        const risk_profile = RISK_PROFILES.find((r) => r.toLowerCase() === rawRisk.toLowerCase()) || "Moderate";
        const official_thesis = thesisIdx >= 0 ? (cols[thesisIdx] || "").slice(0, 5000) : "";

        const row: CsvRow = { ticker, isin, name, asset_class, official_thesis, risk_profile, valid: true };
        return validateRow(row, existingTickers, seenTickers);
      });

      setCsvRows(rows);
      setCsvDialogOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportCsv = async () => {
    const validRows = csvRows.filter((r) => r.valid);
    if (validRows.length === 0) { toast.error("Nenhuma linha válida para importar"); return; }

    setImporting(true);
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    const existingTickers = new Set(assets.map((a) => a.ticker.toUpperCase()));

    for (const row of validRows) {
      const payload = {
        ticker: row.ticker,
        isin: row.isin || null,
        name: row.name,
        asset_class: row.asset_class,
        official_thesis: row.official_thesis,
        risk_profile: row.risk_profile,
      } as any;

      if (existingTickers.has(row.ticker)) {
        const { error } = await supabase.from("asset_knowledge").update({
          ...payload,
          updated_at: new Date().toISOString(),
        }).eq("ticker", row.ticker);
        if (error) { errors++; } else { updated++; }
      } else {
        const { error } = await supabase.from("asset_knowledge").insert(payload);
        if (error) { errors++; } else { inserted++; }
      }
    }

    setImporting(false);
    setCsvDialogOpen(false);
    setCsvRows([]);

    const parts: string[] = [];
    if (inserted > 0) parts.push(`${inserted} inserido(s)`);
    if (updated > 0) parts.push(`${updated} atualizado(s)`);
    if (errors > 0) parts.push(`${errors} erro(s)`);
    toast.success(`Importação concluída: ${parts.join(", ")}`);
    fetchAssets();
  };

  const validCount = csvRows.filter((r) => r.valid).length;
  const invalidCount = csvRows.filter((r) => !r.valid).length;

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Asset Dictionary</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 text-sm">
              <Download className="h-4 w-4" /> Template CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2 text-sm">
              <Upload className="h-4 w-4" /> Importar CSV
            </Button>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Ativo
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Cadastre a tese oficial da gestão para cada ativo com Ticker e ISIN. Esses identificadores são a chave primária para busca de dados de mercado em tempo real.
        </p>

        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum ativo cadastrado ainda.</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button onClick={openNew} variant="outline">Cadastrar primeiro ativo</Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Importar via CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Ticker</TableHead>
                  <TableHead className="w-[140px]">ISIN</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[130px]">Classe</TableHead>
                  <TableHead className="w-[110px]">Perfil de Risco</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-semibold text-primary">{a.ticker}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.isin || "—"}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="text-sm">{a.asset_class}</TableCell>
                    <TableCell className="text-sm">{a.risk_profile}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Ativo" : "Novo Ativo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Identifiers section - prominent */}
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
                    <SelectContent>
                      {ASSET_CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Perfil de Risco</label>
                  <Select value={form.risk_profile} onValueChange={(v) => setForm({ ...form, risk_profile: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RISK_PROFILES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tese Oficial da Gestão</label>
                <Textarea value={form.official_thesis} onChange={(e) => setForm({ ...form, official_thesis: e.target.value })} placeholder="Descreva a tese oficial e o racional da posição..." rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CSV Import Preview Dialog */}
        <Dialog open={csvDialogOpen} onOpenChange={(open) => { if (!importing) { setCsvDialogOpen(open); if (!open) setCsvRows([]); } }}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Preview da Importação CSV
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {validCount} válido(s)
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-4 w-4" /> {invalidCount} inválido(s)
                </span>
              )}
              <span className="text-muted-foreground">Total: {csvRows.length} linha(s)</span>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Status</TableHead>
                    <TableHead className="w-[80px]">Ticker</TableHead>
                    <TableHead className="w-[120px]">ISIN</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[110px]">Classe</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvRows.map((row, i) => (
                    <TableRow key={i} className={!row.valid ? "opacity-50" : ""}>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{row.ticker}</TableCell>
                      <TableCell className="font-mono text-xs">{row.isin || "—"}</TableCell>
                      <TableCell className="text-sm">{row.name}</TableCell>
                      <TableCell className="text-xs">{row.asset_class}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.error || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setCsvDialogOpen(false); setCsvRows([]); }} disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={handleImportCsv} disabled={importing || validCount === 0} className="gap-2">
                {importing ? "Importando..." : `Importar ${validCount} ativo(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
