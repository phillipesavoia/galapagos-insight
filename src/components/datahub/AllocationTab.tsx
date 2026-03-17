import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AllocationSlice {
  id?: string;
  asset_class: string;
  weight_pct: number;
  color: string;
}

interface PortfolioModel {
  name: string;
  allocations: AllocationSlice[];
}

interface Holding {
  id?: string;
  portfolio_name: string;
  asset_name: string;
  ticker: string;
  asset_class: string;
  weight_percentage: number;
  is_active: boolean;
}

const palette = [
  "hsl(var(--primary))",
  "hsl(200, 80%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(var(--muted-foreground))",
  "hsl(160, 60%, 45%)",
  "hsl(320, 50%, 50%)",
];

const portfolioNames = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];

// ── Holdings Sub-section ──
function HoldingsSection({ portfolioName }: { portfolioName: string }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Holding[]>([]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchHoldings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("portfolio_name", portfolioName)
      .eq("is_active", true)
      .order("asset_class")
      .order("weight_percentage", { ascending: false });

    if (error) console.error("Error fetching holdings:", error);
    setHoldings((data as Holding[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) fetchHoldings();
  }, [expanded, portfolioName]);

  const startEdit = () => {
    setDraft(holdings.map((h) => ({ ...h })));
    setEditing(true);
  };

  const addRow = () => {
    setDraft([
      ...draft,
      { portfolio_name: portfolioName, asset_name: "", ticker: "", asset_class: "", weight_percentage: 0, is_active: true },
    ]);
  };

  const removeRow = (idx: number) => setDraft(draft.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: keyof Holding, value: string | number) => {
    const next = [...draft];
    (next[idx] as any)[field] = value;
    setDraft(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete old rows
      await supabase.from("portfolio_holdings").delete().eq("portfolio_name", portfolioName);
      // Insert new
      if (draft.length > 0) {
        const rows = draft.map((h) => ({
          portfolio_name: portfolioName,
          asset_name: h.asset_name,
          ticker: h.ticker || null,
          asset_class: h.asset_class,
          weight_percentage: h.weight_percentage,
          is_active: true,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("portfolio_holdings").insert(rows);
        if (error) throw error;
      }
      toast.success(`Holdings de ${portfolioName} atualizadas`);
      setEditing(false);
      await fetchHoldings();
    } catch (e: any) {
      toast.error("Erro ao salvar holdings: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const total = holdings.reduce((s, h) => s + Number(h.weight_percentage), 0);

  // Group by asset_class
  const grouped: Record<string, Holding[]> = {};
  holdings.forEach((h) => {
    if (!grouped[h.asset_class]) grouped[h.asset_class] = [];
    grouped[h.asset_class].push(h);
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">Detalhamento de Ativos</span>
        {holdings.length > 0 && !expanded && (
          <span className="text-[10px] text-muted-foreground ml-auto">{holdings.length} ativos</span>
        )}
      </button>

      {expanded && (
        <div className="mt-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_0.6fr_0.8fr_0.5fr_auto] gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <span>Ativo</span>
                <span>Ticker</span>
                <span>Classe</span>
                <span className="text-right">Peso%</span>
                <span></span>
              </div>
              {draft.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_0.6fr_0.8fr_0.5fr_auto] gap-1">
                  <Input value={h.asset_name} onChange={(e) => updateRow(i, "asset_name", e.target.value)} className="h-6 text-xs px-1" placeholder="Nome" />
                  <Input value={h.ticker} onChange={(e) => updateRow(i, "ticker", e.target.value)} className="h-6 text-xs px-1" placeholder="Ticker" />
                  <Input value={h.asset_class} onChange={(e) => updateRow(i, "asset_class", e.target.value)} className="h-6 text-xs px-1" placeholder="Classe" />
                  <Input type="number" value={h.weight_percentage} onChange={(e) => updateRow(i, "weight_percentage", Number(e.target.value))} className="h-6 text-xs px-1 text-right" />
                  <button onClick={() => removeRow(i)} className="text-destructive/60 hover:text-destructive p-0.5">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addRow}>
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-6 text-xs gap-1" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              </div>
            </div>
          ) : holdings.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">Nenhum ativo cadastrado.</p>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={startEdit}>
                <Plus className="h-3 w-3" /> Cadastrar Ativos
              </Button>
            </div>
          ) : (
            <div>
              <div className="space-y-2">
                {Object.entries(grouped).map(([cls, items]) => {
                  const classTotal = items.reduce((s, h) => s + Number(h.weight_percentage), 0);
                  return (
                    <div key={cls}>
                      <div className="flex items-center justify-between px-1 py-0.5">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cls}</span>
                        <span className="text-[10px] font-semibold text-foreground tabular-nums">{classTotal.toFixed(1)}%</span>
                      </div>
                      {items.map((h) => (
                        <div key={h.id} className="flex items-center justify-between px-1 py-0.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-foreground font-medium break-words">{h.asset_name}</span>
                            {h.ticker && <span className="text-muted-foreground text-[10px]">({h.ticker})</span>}
                          </div>
                          <span className="text-foreground font-semibold tabular-nums shrink-0">{Number(h.weight_percentage).toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-1 pt-2 mt-2 border-t border-border">
                <span className="text-xs font-semibold text-foreground">Total</span>
                <span className="text-xs font-bold text-foreground tabular-nums">{total.toFixed(1)}%</span>
              </div>
              <div className="flex justify-end mt-2">
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={startEdit}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Portfolio Card (unchanged logic, adds HoldingsSection) ──
function PortfolioCard({
  model,
  onSave,
}: {
  model: PortfolioModel;
  onSave: (name: string, allocations: AllocationSlice[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AllocationSlice[]>([]);

  const startEdit = () => {
    setDraft(model.allocations.map((a) => ({ ...a })));
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const handleSave = async () => {
    const total = draft.reduce((s, a) => s + Number(a.weight_pct), 0);
    if (Math.abs(total - 100) > 0.5) {
      toast.error(`Total deve ser 100%. Atual: ${total.toFixed(1)}%`);
      return;
    }
    setSaving(true);
    try {
      await onSave(model.name, draft.filter((d) => d.weight_pct > 0));
      setEditing(false);
      toast.success(`${model.name} atualizado`);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const updateWeight = (idx: number, val: string) => {
    const next = [...draft];
    next[idx] = { ...next[idx], weight_pct: Number(val) || 0 };
    setDraft(next);
  };

  const updateClass = (idx: number, val: string) => {
    const next = [...draft];
    next[idx] = { ...next[idx], asset_class: val };
    setDraft(next);
  };

  const addSlice = () => {
    setDraft([...draft, { asset_class: "", weight_pct: 0, color: palette[draft.length % palette.length] }]);
  };

  const removeSlice = (idx: number) => {
    setDraft(draft.filter((_, i) => i !== idx));
  };

  const displayAllocations = editing ? draft : model.allocations;

  return (
    <div className="border border-border rounded-xl bg-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{model.name}</h3>
        {editing ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={cancel} disabled={saving}>
              <X className="h-3 w-3" />
            </Button>
            <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground gap-1" onClick={startEdit}>
            <Pencil className="h-3 w-3" /> Editar Pesos
          </Button>
        )}
      </div>

      <div className="flex items-center gap-5 flex-1">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayAllocations.filter((a) => a.weight_pct > 0)}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={48}
                dataKey="weight_pct"
                nameKey="asset_class"
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {displayAllocations
                  .filter((a) => a.weight_pct > 0)
                  .map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(240,15%,7%)",
                  border: "1px solid hsl(240,10%,16%)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value: number) => `${value}%`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {editing ? (
            <>
              {draft.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                  <Input
                    value={a.asset_class}
                    onChange={(e) => updateClass(i, e.target.value)}
                    className="h-6 text-xs px-1 flex-1"
                    placeholder="Classe"
                  />
                  <Input
                    type="number"
                    value={a.weight_pct}
                    onChange={(e) => updateWeight(i, e.target.value)}
                    className="h-6 text-xs px-1 w-14 text-right"
                    min={0}
                    max={100}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <button onClick={() => removeSlice(i)} className="text-destructive/60 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs mt-1 gap-1" onClick={addSlice}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </>
          ) : (
            displayAllocations.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="text-xs text-muted-foreground break-words">{a.asset_class}</span>
                </div>
                <span className="text-xs font-semibold text-foreground tabular-nums">{a.weight_pct}%</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Holdings drill-down section */}
      <HoldingsSection portfolioName={model.name} />
    </div>
  );
}

export function AllocationTab() {
  const [models, setModels] = useState<PortfolioModel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("model_allocations")
      .select("*")
      .order("portfolio_name")
      .order("weight_pct", { ascending: false });

    if (error) {
      console.error("Error fetching allocations:", error);
      toast.error("Erro ao carregar alocações");
      setLoading(false);
      return;
    }

    const grouped: Record<string, AllocationSlice[]> = {};
    portfolioNames.forEach((n) => (grouped[n] = []));

    (data || []).forEach((row: any) => {
      if (!grouped[row.portfolio_name]) grouped[row.portfolio_name] = [];
      grouped[row.portfolio_name].push({
        id: row.id,
        asset_class: row.asset_class,
        weight_pct: Number(row.weight_pct),
        color: row.color || palette[grouped[row.portfolio_name].length % palette.length],
      });
    });

    setModels(portfolioNames.map((name) => ({ name, allocations: grouped[name] || [] })));
    setLoading(false);
  };

  useEffect(() => {
    fetchAllocations();
  }, []);

  const handleSave = async (portfolioName: string, allocations: AllocationSlice[]) => {
    await supabase.from("model_allocations").delete().eq("portfolio_name", portfolioName);

    const rows = allocations.map((a, i) => ({
      portfolio_name: portfolioName,
      asset_class: a.asset_class,
      weight_pct: a.weight_pct,
      color: palette[i % palette.length],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("model_allocations").insert(rows);
    if (error) throw error;

    await fetchAllocations();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {models.map((m) => (
        <PortfolioCard key={m.name} model={m} onSave={handleSave} />
      ))}
    </div>
  );
}
