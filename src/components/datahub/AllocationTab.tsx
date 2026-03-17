import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, Loader2, Plus, Trash2 } from "lucide-react";
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
                  <span className="text-xs text-muted-foreground truncate">{a.asset_class}</span>
                </div>
                <span className="text-xs font-semibold text-foreground tabular-nums">{a.weight_pct}%</span>
              </div>
            ))
          )}
        </div>
      </div>
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

    (data || []).forEach((row: any, idx: number) => {
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
    // Delete existing rows for this portfolio, then insert new ones
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
