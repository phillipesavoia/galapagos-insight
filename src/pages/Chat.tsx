import { useState } from "react";
import { Send, ChevronDown, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/Layout";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { name: string; period: string }[];
}

const mockMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Qual foi o desempenho do fundo Macro Global em janeiro de 2025?",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "O fundo **Galapagos Macro Global** apresentou retorno de **+1.82%** em janeiro de 2025, acumulando **+14.3% nos últimos 12 meses**. O resultado foi impulsionado por posições em juros americanos e crédito high yield. A volatilidade realizada ficou em 6.2% a.a., dentro da banda alvo.\n\nO drawdown máximo no período foi de -0.45%, rapidamente recuperado. A alocação em duration longa contribuiu positivamente com a abertura moderada da curva de treasuries.",
    sources: [
      { name: "Factsheet Macro Global", period: "Jan 2025" },
      { name: "Carta Mensal", period: "Jan 2025" },
      { name: "Apresentação Trimestral", period: "Q4 2024" },
    ],
  },
  {
    id: "3",
    role: "user",
    content: "Como está a posição de crédito e qual a duration média?",
  },
  {
    id: "4",
    role: "assistant",
    content:
      "A alocação em **crédito** representa atualmente **34% do portfólio**, dividida entre:\n\n- **Investment Grade**: 18% (duration média 3.2 anos)\n- **High Yield**: 12% (duration média 2.1 anos)\n- **Crédito Estruturado**: 4% (CLOs e ABS)\n\nA **duration média total** do fundo é de **4.8 anos**, ligeiramente acima da média histórica de 4.2 anos, refletindo a visão construtiva da equipe sobre a trajetória de juros nos EUA.\n\nO spread médio ponderado da carteira de crédito é de **185 bps** sobre treasuries, com yield-to-worst de **6.8%**.",
    sources: [
      { name: "Factsheet Macro Global", period: "Jan 2025" },
      { name: "Relatório de Risco", period: "Jan 2025" },
    ],
  },
];

const suggestions = [
  "Qual foi o drawdown máximo no último trimestre?",
  "Compare os fundos de menor correlação com S&P 500",
  "Como explicar nossa posição em crédito para um cliente conservador?",
  "O que dissemos sobre Duration na carta de fevereiro?",
];

const filterChips = ["Todos os documentos", "Factsheets", "Cartas Mensais", "Apresentações"];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [input, setInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos os documentos");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showSourcesPanel, setShowSourcesPanel] = useState(true);

  const isEmpty = messages.length === 0;

  const lastAssistantSources = [...messages].reverse().find((m) => m.role === "assistant")?.sources || [];

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    const newMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: msg };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    // Mock assistant response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Obrigado pela pergunta. Estou analisando os documentos indexados para fornecer uma resposta completa com base nas fontes disponíveis...",
          sources: [{ name: "Factsheet Macro Global", period: "Fev 2025" }],
        },
      ]);
    }, 800);
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
