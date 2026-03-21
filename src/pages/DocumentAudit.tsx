import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, CheckCircle, AlertTriangle, XCircle, Pencil, Copy,
  Search, Loader2, BarChart3, Presentation, ClipboardList
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

function isCovered(asset: Asset, documents: Doc[]): "covered" | "partial" | "none" {
  const nameLower = asset.name.toLowerCase();
  const tickerUpper = asset.ticker.toUpperCase();
  let hasPartial = false;

  for (const doc of documents) {
    const fundLower = (doc.fund_name || "").toLowerCase();
    const docNameLower = (doc.name || "").toLowerCase();
    const meta = (doc.metadata || {}) as Record<string, unknown>;
    const metaTicker = ((meta.detected_ticker as string) || "").toUpperCase();
    const metaTickerEx = ((meta.detected_ticker_exchange as string) || "").toUpperCase();

    const matches =
      (fundLower.length >= 8 && nameLower.includes(fundLower.substring(0, 8))) ||
      (nameLower.length >= 8 && fundLower.includes(nameLower.substring(0, 8))) ||
      docNameLower.includes(tickerUpper.toLowerCase()) ||
      metaTicker === tickerUpper ||
      metaTickerEx.includes(tickerUpper);

    if (matches) {
      if (doc.status === "indexed") return "covered";
      hasPartial = true;
    }
  }
  return hasPartial ? "partial" : "none";
}

function getMatchedDoc(asset: Asset, documents: Doc[]): Doc | null {
  const nameLower = asset.name.toLowerCase();
  const tickerUpper = asset.ticker.toUpperCase();

  for (const doc of documents) {
    const fundLower = (doc.fund_name || "").toLowerCase();
    const docNameLower = (doc.name || "").toLowerCase();
    const meta = (doc.metadata || {}) as Record<string, unknown>;
    const metaTicker = ((meta.detected_ticker as string) || "").toUpperCase();
    const metaTickerEx = ((meta.detected_ticker_exchange as string) || "").toUpperCase();

    const matches =
      (fundLower.length >= 8 && nameLower.includes(fundLower.substring(0, 8))) ||
      (nameLower.length >= 8 && fundLower.includes(nameLower.substring(0, 8))) ||
      docNameLower.includes(tickerUpper.toLowerCase()) ||
      metaTicker === tickerUpper ||
      metaTickerEx.includes(tickerUpper);

    if (matches) return doc;
  }
  return null;
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
type AssetFilter = "all" | "covered" | "uncovered" | "by_class";

export default function DocumentAudit() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [docSearch, setDocSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [docFilter, setDocFilter] = useState<DocFilter>("all");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fund_name: "", period: "", type: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
    const coverageMap = assets.map(a => isCovered(a, documents));
    const covered = coverageMap.filter(c => c === "covered" || c === "partial").length;
    const uncovered = coverageMap.filter(c => c === "none").length;
    return { indexed, processing, covered, uncovered };
  }, [documents, assets]);

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
    let list = assets.map(a => ({ ...a, coverage: isCovered(a, documents) }));
    if (assetSearch) {
      const q = assetSearch.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) || a.ticker.toLowerCase().includes(q)
      );
    }
    if (assetFilter === "covered") list = list.filter(a => a.coverage === "covered");
    else if (assetFilter === "uncovered") list = list.filter(a => a.coverage === "none");
    // Sort uncovered first
    list.sort((a, b) => {
      const order = { none: 0, partial: 1, covered: 2 };
      return order[a.coverage] - order[b.coverage];
    });
    return list;
  }, [assets, documents, assetSearch, assetFilter]);

  // Class summary
  const classSummary = useMemo(() => {
    const classes: Record<string, { total: number; covered: number }> = {};
    for (const a of assets) {
      if (!classes[a.asset_class]) classes[a.asset_class] = { total: 0, covered: 0 };
      classes[a.asset_class].total++;
      const cov = isCovered(a, documents);
      if (cov === "covered" || cov === "partial") classes[a.asset_class].covered++;
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

  const copyUploadRequest = (asset: Asset) => {
    const text = `Pendente: upload do factsheet de ${asset.name} (${asset.ticker})`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  };

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoria de Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cobertura da base de conhecimento vs investimentos cadastrados
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Documentos indexados", value: stats.indexed, icon: FileText },
            { label: "Investimentos com cobertura", value: stats.covered, icon: CheckCircle },
            { label: "Investimentos sem factsheet", value: stats.uncovered, icon: AlertTriangle },
            { label: "Documentos processando", value: stats.processing, icon: Loader2 },
          ].map((card) => (
            <div key={card.label} className="p-5 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
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
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs">{doc.fund_name}</span>
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
          <div className="space-y-4">
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

            <div className="flex gap-2 flex-wrap">
              {([
                ["all", "Todos"],
                ["covered", "Com Factsheet"],
                ["uncovered", "Sem Factsheet"],
              ] as [AssetFilter, string][]).map(([key, label]) => (
                <button key={key} className={chipClass(assetFilter === key)} onClick={() => setAssetFilter(key)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredAssets.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum investimento encontrado.</p>
              )}
              {filteredAssets.map((asset) => {
                const matchedDoc = getMatchedDoc(asset, documents);
                return (
                  <div key={asset.id} className="p-4 bg-card border border-border rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-primary">{asset.ticker}</span>
                          <span className="text-sm text-foreground truncate">{asset.name}</span>
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
                        <div className="mt-2">
                          {asset.coverage === "covered" && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                                <CheckCircle className="h-3 w-3" /> Coberto
                              </Badge>
                              {matchedDoc && (
                                <span className="text-xs text-muted-foreground truncate max-w-[180px]">{matchedDoc.name}</span>
                              )}
                            </div>
                          )}
                          {asset.coverage === "partial" && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" /> Parcial
                            </Badge>
                          )}
                          {asset.coverage === "none" && (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs gap-1">
                                <XCircle className="h-3 w-3" /> Sem factsheet
                              </Badge>
                              <button
                                onClick={() => copyUploadRequest(asset)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Copy className="h-3 w-3" /> Solicitar upload
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
    </Layout>
  );
}
