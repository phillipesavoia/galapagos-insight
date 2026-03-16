import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  official_thesis: string;
  risk_profile: string;
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

const emptyAsset = { ticker: "", name: "", asset_class: "Fixed Income", official_thesis: "", risk_profile: "Moderate" };

export default function AssetKnowledge() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyAsset);

  const fetchAssets = async () => {
    const { data } = await supabase.from("asset_knowledge").select("*").order("ticker");
    setAssets((data as unknown as Asset[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAssets(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyAsset); setDialogOpen(true); };
  const openEdit = (a: Asset) => { setEditing(a); setForm({ ticker: a.ticker, name: a.name, asset_class: a.asset_class, official_thesis: a.official_thesis, risk_profile: a.risk_profile }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.ticker || !form.name) { toast.error("Ticker e nome são obrigatórios"); return; }
    if (editing) {
      const { error } = await supabase.from("asset_knowledge").update({
        ticker: form.ticker.toUpperCase(),
        name: form.name,
        asset_class: form.asset_class,
        official_thesis: form.official_thesis,
        risk_profile: form.risk_profile,
        updated_at: new Date().toISOString(),
      } as any).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Ativo atualizado");
    } else {
      const { error } = await supabase.from("asset_knowledge").insert({
        ticker: form.ticker.toUpperCase(),
        name: form.name,
        asset_class: form.asset_class,
        official_thesis: form.official_thesis,
        risk_profile: form.risk_profile,
      } as any);
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

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Asset Dictionary</h1>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Ativo
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Cadastre a tese oficial da gestão para cada ativo. Essas informações são usadas pelo chat como base de conhecimento prioritária.
        </p>

        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum ativo cadastrado ainda.</p>
            <Button onClick={openNew} variant="outline" className="mt-4">Cadastrar primeiro ativo</Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Ticker</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[140px]">Classe</TableHead>
                  <TableHead className="w-[120px]">Perfil de Risco</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-semibold">{a.ticker}</TableCell>
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Ativo" : "Novo Ativo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ticker *</label>
                  <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="Ex: HYG" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: iShares High Yield Corp Bond" />
                </div>
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
      </div>
    </Layout>
  );
}
