import { useState } from "react";
import { Send, ChevronDown, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { name: string; period: string }[];
}

const suggestions = [
  "Qual foi o drawdown máximo no último trimestre?",
  "Compare os fundos de menor correlação com S&P 500",
  "Como explicar nossa posição em crédito para um cliente conservador?",
  "O que dissemos sobre Duration na carta de fevereiro?",
];

const filterChips = ["Todos os documentos", "Factsheets", "Cartas Mensais", "Apresentações"];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos os documentos");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showSourcesPanel, setShowSourcesPanel] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const isEmpty = messages.length === 0;

  const lastAssistantSources = [...messages].reverse().find((m) => m.role === "assistant")?.sources || [];

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsLoading(true);

    const filterMap: Record<string, string> = {
      "Factsheets": "factsheet",
      "Cartas Mensais": "carta_mensal",
      "Apresentações": "apresentacao",
    };
    const filter_type = filterMap[activeFilter] || "all";

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { query: msg, filter_type },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Erro ao processar sua pergunta. Tente novamente.",
        sources: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex h-screen">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-xl w-full text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
                  Olá. O que você quer saber sobre os nossos fundos?
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                  Pesquiso na base de documentos indexados para responder.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary/10 border border-primary/20 text-foreground"
                        : "bg-card border border-border text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <button
                          onClick={() =>
                            setExpandedSources((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {expandedSources[msg.id] ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Fontes ({msg.sources.length})
                        </button>
                        {expandedSources[msg.id] && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.sources.map((src, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary text-xs text-muted-foreground"
                              >
                                {src.name} · {src.period}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-4">
            <div className="flex gap-2 mb-3">
              {filterChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setActiveFilter(chip)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    activeFilter === chip
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Pergunte sobre fundos, teses ou performance..."
                rows={1}
                className="flex-1 resize-none bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={() => handleSend()}
                className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Sources Panel */}
        {showSourcesPanel && (
          <div className="w-72 border-l border-border bg-card flex flex-col shrink-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Fontes utilizadas</h3>
              <button onClick={() => setShowSourcesPanel(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
              {lastAssistantSources.length > 0 ? (
                lastAssistantSources.map((src, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary border border-border">
                    <p className="text-sm font-medium text-foreground">{src.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{src.period}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma fonte disponível.</p>
              )}
            </div>
          </div>
        )}
        {!showSourcesPanel && (
          <button
            onClick={() => setShowSourcesPanel(true)}
            className="absolute right-4 top-4 p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </Layout>
  );
}
