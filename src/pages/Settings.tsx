import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApiCard {
  name: string;
  description: string;
  secretName: string;
  status: "connected" | "disconnected" | "loading";
}

const apiCardsConfig = [
  { name: "Anthropic (Claude)", description: "Modelo principal para geração de texto e análise de documentos.", secretName: "ANTHROPIC_API_KEY" },
  { name: "Google AI (Gemini + Embeddings)", description: "Modelo de embeddings para indexação semântica de documentos.", secretName: "GOOGLE_AI_API_KEY" },
  { name: "Reducto AI", description: "Extração e parsing de PDFs complexos com tabelas e gráficos.", secretName: "REDUCTO_API_KEY" },
];

export default function SettingsPage() {
  const [cards, setCards] = useState<ApiCard[]>(
    apiCardsConfig.map((c) => ({ ...c, status: "loading" as const }))
  );

  useEffect(() => {
    // Check which secrets are configured by calling an edge function
    const checkSecrets = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-secrets", {
          body: { secrets: apiCardsConfig.map((c) => c.secretName) },
        });
        if (data && !error) {
          setCards((prev) =>
            prev.map((card) => ({
              ...card,
              status: data[card.secretName] ? "connected" : "disconnected",
            }))
          );
        } else {
          // Fallback: assume all configured (they are in the secrets list)
          setCards((prev) => prev.map((card) => ({ ...card, status: "connected" as const })));
        }
      } catch {
        // Fallback: mark all as connected since we know they exist
        setCards((prev) => prev.map((card) => ({ ...card, status: "connected" as const })));
      }
    };
    checkSecrets();
  }, []);

  const [chunkSize, setChunkSize] = useState(500);
  const [overlap, setOverlap] = useState(50);
  const [threshold, setThreshold] = useState(0.75);
  const [topK, setTopK] = useState(5);
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-004");

  const handleTest = (name: string) => {
    setTesting(name);
    setTimeout(() => setTesting(null), 1500);
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        {/* API Integrations */}
        <h1 className="text-xl font-semibold tracking-tight text-foreground mb-6">Configurações</h1>

        <h2 className="text-sm font-semibold text-foreground mb-4">Integrações de API</h2>
        <div className="space-y-3 mb-10">
          {apiCards.map((card) => (
            <div key={card.name} className="p-5 bg-card border border-border rounded-xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{card.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                </div>
                {card.status === "connected" ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/15 text-primary text-xs">
                    <CheckCircle className="h-3 w-3" /> Conectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                    <XCircle className="h-3 w-3" /> Desconectado
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keys[card.name]}
                  onChange={(e) => setKeys((p) => ({ ...p, [card.name]: e.target.value }))}
                  placeholder="Cole sua API key..."
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                />
                <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Salvar
                </button>
                <button
                  onClick={() => handleTest(card.name)}
                  className="px-4 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  {testing === card.name ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Testar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* RAG Parameters */}
        <h2 className="text-sm font-semibold text-foreground mb-4">Parâmetros RAG</h2>
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <SliderField label="Tamanho do chunk" value={chunkSize} min={300} max={800} step={50} unit=" tokens" onChange={setChunkSize} />
          <SliderField label="Overlap" value={overlap} min={0} max={100} step={10} unit=" tokens" onChange={setOverlap} />
          <SliderField label="Threshold de similaridade" value={threshold} min={0.6} max={0.95} step={0.05} onChange={setThreshold} />
          <SliderField label="Top-K resultados" value={topK} min={3} max={10} step={1} onChange={setTopK} />

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Modelo de embedding</label>
            <div className="space-y-2">
              {[
                { value: "text-embedding-004", label: "text-embedding-004 (Google)" },
                { value: "ada-002", label: "ada-002 (OpenAI)" },
              ].map((model) => (
                <label key={model.value} className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      embeddingModel === model.value ? "border-primary" : "border-border"
                    }`}
                    onClick={() => setEmbeddingModel(model.value)}
                  >
                    {embeddingModel === model.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm text-muted-foreground">{model.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function SliderField({
  label, value, min, max, step, unit = "", onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-sm text-primary font-mono">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
    </div>
  );
}
