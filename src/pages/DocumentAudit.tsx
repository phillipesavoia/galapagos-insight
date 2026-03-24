import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useDocuments } from "@/hooks/useDocuments";
import { UploadModal } from "@/components/library/UploadModal";
import {
  FileText, CheckCircle, AlertTriangle, XCircle, Pencil, Copy,
  Search, Loader2, Upload, Plus, X, ArrowRight, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Doc {
  id: string;
  name: string;
  type: string | null;
  fund_name: string | null;
  period: string | null;
  status: string | null;
  chunk_count: number | null;
  uploaded_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  portfolios: string[] | null;
  isin: string | null;
}

interface CoverageResult {
  status: "covered" | "partial" | "none";
  lastUpdated: string | null;
  docName: string | null;
}

function getCoverage(asset: Asset, documents: Doc[]): CoverageResult {
  const matches = documents.filter(doc => {
    if (doc.status !== 'indexed') return false;

    const assetName = asset.name.toLowerCase().trim();
    const assetIsin = (asset.isin || '').toUpperCase().trim();
    const assetTicker = asset.ticker.toUpperCase()
      .replace(/\s+LN\s+EQUITY$/i, '').replace(/\s+US\s+EQUITY$/i, '')
      .replace(/\s+ID\s+EQUITY$/i, '').replace(/\s+LX\s+EQUITY$/i, '')
      .replace(/\s+CORP$/i, '').replace(/\s+GOVT$/i, '')
      .replace(/\s+LN$/i, '').replace(/\s+US$/i, '').replace(/\s+ID$/i, '')
      .trim();

    const fundName = (doc.fund_name || '').toUpperCase().trim();
    const docName = (doc.name || '').toLowerCase().trim();
    const meta = (doc.metadata || {}) as Record<string, unknown>;
    const metaTicker = ((meta.detected_ticker as string) || '').toUpperCase().trim();
    const metaTickerEx = ((meta.detected_ticker_exchange as string) || '').toUpperCase().trim();
    const metaIsin = ((meta.detected_isin as string) || '').toUpperCase().trim();
    const docIsin = ((meta.isin as string) || '').toUpperCase().trim();

    // ISIN exact match — most reliable (covers auto-fetched docs that use ISIN as fund_name)
    if (assetIsin && fundName && assetIsin === fundName) return true;
    if (assetIsin && metaIsin && assetIsin === metaIsin) return true;
    if (assetIsin && docIsin && assetIsin === docIsin) return true;

    // Ticker exact match
    if (assetTicker && metaTicker && metaTicker === assetTicker) return true;
    if (assetTicker && metaTickerEx && metaTickerEx.startsWith(assetTicker)) return true;

    // Clean ticker in doc name
    if (assetTicker.length >= 3 && docName.includes(assetTicker.toLowerCase())) return true;

    // Fund name substring match (minimum 10 chars to avoid false positives)
    const fundNameLower = fundName.toLowerCase();
    if (fundNameLower.length >= 10 && assetName.includes(fundNameLower)) return true;
    if (assetName.length >= 10 && fundNameLower.includes(assetName)) return true;

    return false;
  });

  if (matches.length === 0) return { status: "none", lastUpdated: null, docName: null };

  const latest = [...matches].sort(
    (a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime()
  )[0];
  const allIndexed = matches.every(d => d.status === "indexed");

  return {
    status: allIndexed ? "covered" : "partial",
    lastUpdated: latest.uploaded_at,
    docName: latest.fund_name || latest.name,
  };
}

const typeLabels: Record<string, string> = {
  factsheet: "Factsheet",
  carta_mensal: "Carta Mensal",
  apresentacao: "Apresentação",
  outro: "Outro",
};

const typeColors: Record<string, string> = {
  factsheet: "bg-blue-500/15 text-blue-400",
  apresentacao: "bg-purple-500/15 text-purple-400",
  carta_mensal: "bg-amber-500/15 text-amber-400",
  outro: "bg-muted text-muted-foreground",
};

type DocFilter = "all" | "factsheet" | "apresentacao" | "processing" | "error";
function detectAssetType(ticker: string, name: string): string {
  const t = ticker.toUpperCase().trim();
  const n = name.toLowerCase().trim();
  if (n.includes("amc") || n.includes("opus")) return "amc";
  if (t.endsWith("INDEX") || t.endsWith(" INDEX")) return "index";
  if (t.endsWith("LN EQUITY") || t.endsWith(" LN")) return "ucits_etf";
  if (t.endsWith("ID EQUITY") || t.endsWith(" ID")) return "offshore_fund";
  if (t.endsWith("US EQUITY") || t.endsWith(" US")) return "us_etf";
  if (t.endsWith("CORP") || t.endsWith("GOVT")) return "bond";
  return "manual";
}

const assetTypeBadge: Record<string, { label: string; className: string }> = {
  us_etf: { label: "US ETF", className: "bg-blue-500/15 text-blue-400" },
  ucits_etf: { label: "UCITS", className: "bg-purple-500/15 text-purple-400" },
  offshore_fund: { label: "Offshore", className: "bg-teal-500/15 text-teal-400" },
  bond: { label: "Bond", className: "bg-rose-500/15 text-rose-400" },
  amc: { label: "AMC", className: "bg-primary/10 text-primary" },
  index: { label: "Índice", className: "bg-yellow-500/15 text-yellow-600" },
  manual: { label: "Alternativo", className: "bg-muted text-muted-foreground" },
};

function getDisplayFundName(doc: Doc, assets: Asset[]): string {
  const fn = doc.fund_name || "";
  // Check if fund_name looks like an ISIN (e.g. IE00B14X4T88)
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(fn)) {
    const matched = assets.find(a => 
      (a.isin || "").toUpperCase() === fn.toUpperCase()
    );
    if (matched) return matched.name;
  }
  return fn;
}

export default function DocumentAudit() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [docSearch, setDocSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [docFilter, setDocFilter] = useState<DocFilter>("all");
  const [assetFilter, setAssetFilter] = useState<string>("all"); // "all" | "covered" | "uncovered" | class name
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fund_name: "", period: "", type: "" });
  const [saving, setSaving] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [inlineUploading, setInlineUploading] = useState(false);
  const [fetchingAssets, setFetchingAssets] = useState<Record<string, "loading" | "success" | "not_found" | "manual" | "skipped" | "error">>({});
  const [fetchAllLoading, setFetchAllLoading] = useState(false);
  const { toast } = useToast();
  const { uploadDocument } = useDocuments();
  const rightColRef = useRef<HTMLDivElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const [docsRes, assetsRes] = await Promise.all([
      supabase
        .from("documents")
        .select("id, name, type, fund_name, period, status, chunk_count, uploaded_at, metadata")
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("asset_knowledge")
        .select("id, ticker, name, asset_class, portfolios, isin")
        .order("name"),
    ]);
    setDocuments((docsRes.data as Doc[]) || []);
    setAssets((assetsRes.data as Asset[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Summary stats
  const stats = useMemo(() => {
    const indexed = documents.filter(d => d.status === "indexed").length;
    const processing = documents.filter(d => d.status === "processing").length;
    const coverageResults = assets.map(a => getCoverage(a, documents));
    const covered = coverageResults.filter(c => c.status === "covered" || c.status === "partial").length;
    const uncovered = coverageResults.filter(c => c.status === "none").length;
    return { indexed, processing, covered, uncovered };
  }, [documents, assets]);

  // Unique asset classes
  const uniqueClasses = useMemo(() => {
    const classes = new Set(assets.map(a => a.asset_class));
    return Array.from(classes).sort();
  }, [assets]);

  // Filtered docs
  const filteredDocs = useMemo(() => {
    let list = documents;
    if (docSearch) {
      const q = docSearch.toLowerCase();
      list = list.filter(d =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.fund_name || "").toLowerCase().includes(q)
      );
    }
    if (docFilter === "factsheet") list = list.filter(d => d.type === "factsheet");
    else if (docFilter === "apresentacao") list = list.filter(d => d.type === "apresentacao");
    else if (docFilter === "processing") list = list.filter(d => d.status === "processing");
    else if (docFilter === "error") list = list.filter(d => d.status === "error");
    return list;
  }, [documents, docSearch, docFilter]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    let list = assets.map(a => ({ ...a, coverageResult: getCoverage(a, documents) }));
    if (assetSearch) {
      const q = assetSearch.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) || a.ticker.toLowerCase().includes(q)
      );
    }
    if (assetFilter === "covered") list = list.filter(a => a.coverageResult.status === "covered");
    else if (assetFilter === "uncovered") list = list.filter(a => a.coverageResult.status === "none");
    else if (assetFilter !== "all") {
      // Filter by class name
      list = list.filter(a => a.asset_class === assetFilter);
    }
    // Sort uncovered first
    list.sort((a, b) => {
      const order = { none: 0, partial: 1, covered: 2 };
      return order[a.coverageResult.status] - order[b.coverageResult.status];
    });
    return list;
  }, [assets, documents, assetSearch, assetFilter]);

  // Class summary
  const classSummary = useMemo(() => {
    const classes: Record<string, { total: number; covered: number }> = {};
    for (const a of assets) {
      if (!classes[a.asset_class]) classes[a.asset_class] = { total: 0, covered: 0 };
      classes[a.asset_class].total++;
      const cov = getCoverage(a, documents);
      if (cov.status === "covered" || cov.status === "partial") classes[a.asset_class].covered++;
    }
    return Object.entries(classes).sort((a, b) => a[0].localeCompare(b[0]));
  }, [assets, documents]);

  const startEdit = (doc: Doc) => {
    setEditingId(doc.id);
    setEditForm({
      fund_name: doc.fund_name || "",
      period: doc.period || "",
      type: doc.type || "outro",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase
      .from("documents")
      .update({
        fund_name: editForm.fund_name || null,
        period: editForm.period || null,
        type: editForm.type || null,
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      toast({ title: "Documento atualizado" });
      setEditingId(null);
      fetchData();
    }
  };

  const handleInlineUpload = async (file: File, asset: Asset) => {
    setInlineUploading(true);
    const success = await uploadDocument(file, {
      name: file.name,
      type: "factsheet",
      fund_name: asset.name,
      period: new Date().toISOString().slice(0, 7),
    });
    setInlineUploading(false);
    if (success) {
      toast({ title: "Factsheet indexado com sucesso!" });
      setUploadingAsset(null);
      fetchData();
    } else {
      toast({ title: "Erro ao indexar factsheet", variant: "destructive" });
    }
  };

  const callAutoFetch = async (asset: { id: string; ticker: string; isin: string | null; name: string }) => {
    setFetchingAssets(prev => ({ ...prev, [asset.id]: "loading" }));
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('auto-fetch-factsheet', {
        body: {
          asset_id: asset.id,
          ticker: asset.ticker,
          isin: asset.isin,
          name: asset.name,
        },
      });
      if (invokeError) throw invokeError;
      const status = data.status as "processing" | "not_found" | "manual" | "skipped" | "error";
      if (status === "processing") {
        setFetchingAssets(prev => ({ ...prev, [asset.id]: "success" }));
        toast({ title: `Buscando factsheet: ${asset.name}`, description: "Indexando em background..." });
        setTimeout(() => fetchData(), 8000);
      } else if (status === "skipped") {
        setFetchingAssets(prev => ({ ...prev, [asset.id]: "skipped" }));
        toast({ title: "Factsheet recente já existe", description: data.reason });
      } else if (status === "manual") {
        setFetchingAssets(prev => ({ ...prev, [asset.id]: "manual" }));
        toast({ title: "Upload manual necessário", description: "Fundo alternativo — factsheet não está em fonte pública.", variant: "destructive" });
      } else {
        setFetchingAssets(prev => ({ ...prev, [asset.id]: "not_found" }));
        toast({ title: "Não encontrado", description: `Não foi possível localizar o factsheet de ${asset.name}`, variant: "destructive" });
      }
    } catch {
      setFetchingAssets(prev => ({ ...prev, [asset.id]: "error" }));
      toast({ title: "Erro", description: "Falha ao buscar factsheet", variant: "destructive" });
    }
  };

  const handleFetchAll = async () => {
    const uncovered = assets.filter(a => getCoverage(a, documents).status === "none");
    setFetchAllLoading(true);
    for (const asset of uncovered) {
      await callAutoFetch(asset);
      await new Promise(r => setTimeout(r, 1500));
    }
    setFetchAllLoading(false);
    toast({ title: "Busca automática concluída", description: `${uncovered.length} investimentos processados.` });
  };

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
      active
        ? "bg-primary/15 text-primary border border-primary/30"
        : "bg-secondary text-muted-foreground border border-transparent hover:bg-accent/10"
    }`;

  if (loading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Auditoria de Documentos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cobertura da base de conhecimento vs investimentos cadastrados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleFetchAll}
              disabled={fetchAllLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {fetchAllLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> Buscando...</>
                : <><Zap className="h-4 w-4" strokeWidth={1.5} /> Buscar todos automaticamente</>
              }
            </button>
            <Button onClick={() => setShowUploadModal(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Upload Documento
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Documentos indexados", value: stats.indexed, icon: FileText, clickable: false },
            { label: "Investimentos com cobertura", value: stats.covered, icon: CheckCircle, clickable: false },
            { label: "Investimentos sem factsheet", value: stats.uncovered, icon: AlertTriangle, clickable: true },
            { label: "Documentos processando", value: stats.processing, icon: Loader2, clickable: false },
          ].map((card) => (
            <div
              key={card.label}
              className={`p-5 bg-card border border-border rounded-xl ${
                card.clickable
                  ? "cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-colors group"
                  : ""
              }`}
              onClick={card.clickable ? () => {
                setAssetFilter("uncovered");
                rightColRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              } : undefined}
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                {card.clickable && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                )}
              </div>
              <p className="text-3xl font-bold text-primary">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-6">
          {/* LEFT: Documents */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Base de Documentos</h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou fundo..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {([
                ["all", "Todos"],
                ["factsheet", "Factsheets"],
                ["apresentacao", "Apresentações"],
                ["processing", "Processando"],
                ["error", "Erro"],
              ] as [DocFilter, string][]).map(([key, label]) => (
                <button key={key} className={chipClass(docFilter === key)} onClick={() => setDocFilter(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredDocs.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum documento encontrado.</p>
              )}
              {filteredDocs.map((doc) => (
                <div key={doc.id} className="p-4 bg-card border border-border rounded-xl">
                  {editingId === doc.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Nome do Fundo</label>
                        <Input
                          value={editForm.fund_name}
                          onChange={(e) => setEditForm(f => ({ ...f, fund_name: e.target.value }))}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Período</label>
                        <Input
                          type="month"
                          value={editForm.period}
                          onChange={(e) => setEditForm(f => ({ ...f, period: e.target.value }))}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Tipo</label>
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm(f => ({ ...f, type: e.target.value }))}
                          className="mt-1 w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="factsheet">Factsheet</option>
                          <option value="apresentacao">Apresentação</option>
                          <option value="carta_mensal">Carta Mensal</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {doc.fund_name && (
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs">{getDisplayFundName(doc, assets)}</span>
                          )}
                          {doc.period && (
                            <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">{doc.period}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-xs ${typeColors[doc.type || "outro"]}`}>
                            {typeLabels[doc.type || "outro"] || doc.type}
                          </span>
                          {doc.status === "indexed" && (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Indexado
                            </span>
                          )}
                          {doc.status === "processing" && (
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Processando
                            </span>
                          )}
                          {doc.status === "error" && (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Erro
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {doc.chunk_count != null && <span>{doc.chunk_count} chunks</span>}
                          {doc.uploaded_at && (
                            <span>{formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true, locale: ptBR })}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(doc)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Assets */}
          <div className="space-y-4" ref={rightColRef}>
            <h2 className="text-lg font-semibold text-foreground">Investimentos cadastrados</h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ticker..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              <button className={chipClass(assetFilter === "all")} onClick={() => setAssetFilter("all")}>
                Todos
              </button>
              <button className={chipClass(assetFilter === "covered")} onClick={() => setAssetFilter("covered")}>
                Com Factsheet
              </button>
              <button className={chipClass(assetFilter === "uncovered")} onClick={() => setAssetFilter("uncovered")}>
                Sem Factsheet
              </button>
              {uniqueClasses.map((cls) => (
                <button key={cls} className={chipClass(assetFilter === cls)} onClick={() => setAssetFilter(cls)}>
                  {cls}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredAssets.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum investimento encontrado.</p>
              )}
              {filteredAssets.map((asset) => {
                const cov = asset.coverageResult;
                const isUploadingThis = uploadingAsset === asset.id;
                const assetType = detectAssetType(asset.ticker, asset.name);
                const assetFetchStatus = fetchingAssets[asset.id];
                const typeBadge = assetTypeBadge[assetType];

                return (
                  <div key={asset.id} className="p-4 bg-card border border-border rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-primary">{asset.ticker}</span>
                          <span className="text-sm text-foreground truncate">{asset.name}</span>
                          {typeBadge && (
                            <span className={`px-2 py-0.5 rounded-md text-xs ${typeBadge.className}`}>
                              {typeBadge.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground">
                            {asset.asset_class}
                          </span>
                          {asset.portfolios?.map((p) => (
                            <span key={p} className="px-1.5 py-0.5 rounded bg-accent/10 text-xs text-muted-foreground">
                              {p}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 space-y-1">
                          {cov.status === "covered" && (
                            <>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                                  <CheckCircle className="h-3 w-3" /> Coberto
                                </Badge>
                                {cov.docName && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">{cov.docName}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Atualizado {cov.lastUpdated
                                  ? formatDistanceToNow(new Date(cov.lastUpdated), { addSuffix: true, locale: ptBR })
                                  : "—"}
                              </p>
                            </>
                          )}
                          {cov.status === "partial" && (
                            <>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> Parcial
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                Atualizado {cov.lastUpdated
                                  ? formatDistanceToNow(new Date(cov.lastUpdated), { addSuffix: true, locale: ptBR })
                                  : "—"}
                              </p>
                            </>
                          )}
                          {cov.status === "none" && !isUploadingThis && (
                            <>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                                  <XCircle className="h-3 w-3" /> Sem factsheet
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Nunca indexado</p>

                              {/* Auto-fetch status display */}
                              {assetFetchStatus === "loading" && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                                </div>
                              )}
                              {assetFetchStatus === "success" && (
                                <div className="flex items-center gap-1.5 text-xs text-primary mt-1">
                                  <CheckCircle className="h-3 w-3" /> Indexando...
                                </div>
                              )}
                              {assetFetchStatus === "skipped" && (
                                <p className="text-xs text-muted-foreground mt-1">Já atualizado</p>
                              )}
                              {assetFetchStatus === "not_found" && (
                                <p className="text-xs text-amber-400 mt-1">Não encontrado — tente upload manual</p>
                              )}
                              {assetFetchStatus === "error" && (
                                <p className="text-xs text-destructive mt-1">Erro — tente novamente</p>
                              )}

                              {/* Action buttons based on asset type */}
                              {!assetFetchStatus || assetFetchStatus === "not_found" || assetFetchStatus === "error" ? (
                                <div className="flex items-center gap-2 mt-2">
                                  {assetType === "amc" && (
                                    <span className="text-xs text-muted-foreground">AMC Galapagos</span>
                                  )}
                                  {assetType === "index" && (
                                    <span className="text-xs text-muted-foreground">
                                      Índice de referência — sem factsheet
                                    </span>
                                  )}
                                  {assetType === "manual" && (
                                    <>
                                      <button
                                        onClick={() => setUploadingAsset(asset.id)}
                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                                      >
                                        <Upload className="h-3 w-3" strokeWidth={1.5} /> Upload Factsheet
                                      </button>
                                      <span className="text-xs text-muted-foreground">Alternativo — upload manual</span>
                                    </>
                                  )}
                                  {(assetType === "us_etf" || assetType === "ucits_etf" ||
                                    assetType === "offshore_fund" || assetType === "bond") && (
                                    <>
                                      <button
                                        onClick={() => callAutoFetch(asset)}
                                        disabled={assetFetchStatus === "loading"}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                                      >
                                        <Zap className="h-3 w-3" strokeWidth={1.5} /> Auto-buscar factsheet
                                      </button>
                                      <button
                                        onClick={() => setUploadingAsset(asset.id)}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Upload className="h-3 w-3" strokeWidth={1.5} /> Upload manual
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline upload panel */}
                    {isUploadingThis && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {inlineUploading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            Indexando...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              ref={inlineFileRef}
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleInlineUpload(file, asset);
                                e.target.value = "";
                              }}
                            />
                            <div
                              onClick={() => inlineFileRef.current?.click()}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files[0];
                                if (file && file.type === "application/pdf") handleInlineUpload(file, asset);
                              }}
                              className="flex-1 border border-dashed border-primary/30 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 cursor-pointer transition-colors text-center"
                            >
                              Arraste o PDF ou clique para selecionar
                            </div>
                            <button
                              onClick={() => setUploadingAsset(null)}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: Class Summary */}
        {classSummary.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Resumo por Classe de Ativo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classSummary.map(([cls, data]) => {
                const pct = data.total > 0 ? Math.round((data.covered / data.total) * 100) : 0;
                return (
                  <div key={cls} className="p-4 bg-card border border-border rounded-xl">
                    <p className="text-sm font-medium text-foreground">{cls}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{data.covered}/{data.total} cobertos</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5 mt-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <UploadModal
        open={showUploadModal}
        onClose={() => { setShowUploadModal(false); fetchData(); }}
        onUpload={uploadDocument}
        initialFiles={[]}
      />
    </Layout>
  );
}
