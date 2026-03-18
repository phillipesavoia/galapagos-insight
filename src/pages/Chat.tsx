import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ChevronDown, ChevronRight, X, Plus, History, ThumbsUp, ThumbsDown, RefreshCw, Copy, PanelLeftClose, PanelLeft, SquarePen, Zap, Activity, Gauge, Signal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { InlineBarChart } from "@/components/chat/InlineBarChart";
import { FlashFactsheet } from "@/components/chat/FlashFactsheet";
import { InlineDonutChart } from "@/components/chat/InlineDonutChart";
import { InlineComparisonTable } from "@/components/chat/InlineComparisonTable";

interface ChatSource {
  name: string;
  period: string;
  file_url?: string | null;
}

interface ToolCallData {
  tool: string;
  input: any;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  toolCalls?: ToolCallData[];
  toolPending?: string | null;
}

interface ChatSession {
  session_id: string;
  preview: string;
  created_at: string;
}

const PORTFOLIO_NAMES = ["Liquidity", "Bonds", "Conservative", "Income", "Balanced", "Growth"];
const PORTFOLIO_REGEX = new RegExp(`\\b(${PORTFOLIO_NAMES.join("|")})\\b`, "i");

const TICKER_REGEX = /\b([A-Z]{2,5}(?:\s+(?:US|LN|GR|FP|JP|HK|AU|CN|IM|NA|SS|SZ|SE|GY|AV|SM|PL|ID|BB|FH|DC|NO|IT|MC|SW|CT))?)\b/;

function detectPortfolio(text: string): string | null {
  const match = text.match(PORTFOLIO_REGEX);
  if (!match) return null;
  return PORTFOLIO_NAMES.find((p) => p.toLowerCase() === match[1].toLowerCase()) || null;
}

function detectTicker(text: string): string | null {
  const SKIP_WORDS = new Set(["ME", "UM", "OS", "NO", "DO", "SE", "OU", "DE", "DA", "NA", "EU", "AS", "AO", "EL", "LA", "EN", "ES", "IT", "AT", "TO", "IN", "ON", "OR", "AN", "IS", "IF", "OF", "BY", "UP", "SO"]);
  const match = text.match(TICKER_REGEX);
  if (!match) return null;
  const ticker = match[1].trim();
  if (SKIP_WORDS.has(ticker)) return null;
  if (ticker.length < 2 || ticker !== ticker.toUpperCase()) return null;
  if (PORTFOLIO_NAMES.some(p => p.toUpperCase() === ticker)) return null;
  return ticker;
}

const allSuggestions = [
  "Qual foi o drawdown máximo no último trimestre?",
  "Compare a performance YTD de todos os portfólios",
  "Como explicar nossa posição em crédito para um cliente conservador?",
  "Mostre os retornos mensais dos portfólios em gráfico",
  "Qual a composição atual do portfólio Growth?",
  "Quais ativos têm menor correlação com o S&P 500?",
  "Qual o Sharpe ratio de cada portfólio no último ano?",
  "Me fale sobre a tese do fundo Conservative",
  "Quais foram as maiores contribuições positivas para o portfólio Balanced?",
  "Compare o risco dos portfólios Income e Growth",
  "Qual a exposição cambial atual dos portfólios?",
  "Quais ativos foram adicionados ou removidos recentemente?",
  "Qual o retorno acumulado do portfólio Income desde o início?",
  "Explique a alocação em renda fixa dos portfólios",
  "Quais são os ativos com maior peso no portfólio Balanced?",
  "Qual a duration média da carteira de bonds?",
];

function getRandomSuggestions(count: number) {
  const shuffled = [...allSuggestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function extractFollowUps(content: string): { cleanContent: string; followUps: string[] } {
  const regex = /💡\s*\*{0,2}Explorar mais:?\*{0,2}\s*\n([\s\S]*?)$/;
  const match = content.match(regex);
  if (!match) return { cleanContent: content, followUps: [] };

  const cleanContent = content.slice(0, match.index).trimEnd();
  const lines = match[1].trim().split("\n").map(l => l.trim()).filter(Boolean);
  const followUps = lines
    .map(l => l.replace(/^\d+\.\s*/, "").trim())
    .filter(q => q.length > 5);

  return { cleanContent, followUps };
}

function generateSessionId() {
  return crypto.randomUUID();
}

// Telemetry Bar Component
function TelemetryBar({ 
  isStreaming, 
  activeModel, 
  latency,
  activePortfolio,
  activeTicker,
  onClearPortfolio,
  onClearTicker,
}: {
  isStreaming: boolean;
  activeModel: string;
  latency: number | null;
  activePortfolio: string | null;
  activeTicker: string | null;
  onClearPortfolio: () => void;
  onClearTicker: () => void;
}) {
  return (
    <div className="h-8 border-b border-white/5 bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 font-mono text-[10px]">
      {/* Left: System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${isStreaming ? 'bg-neon-green animate-pulse' : 'bg-neon-green'}`} />
          <span className="text-muted-foreground uppercase tracking-widest">
            {isStreaming ? 'STREAMING' : 'READY'}
          </span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <div className="flex items-center gap-1 text-muted-foreground">
          <Zap className="h-3 w-3 text-neon-orange" />
          <span className="text-neon-orange uppercase tracking-widest">{activeModel}</span>
        </div>
        {latency !== null && (
          <>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1 text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span className={latency < 500 ? 'text-neon-green' : latency < 2000 ? 'text-neon-orange' : 'text-neon-rose'}>
                {latency}ms
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Active Context */}
      <div className="flex items-center gap-2">
        {activePortfolio && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neon-green/10 text-neon-green border border-neon-green/20 glow-green">
            <Signal className="h-2.5 w-2.5" />
            {activePortfolio}
            <button onClick={onClearPortfolio} className="ml-0.5 text-neon-green/60 hover:text-neon-green">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        )}
        {activeTicker && !activePortfolio && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neon-rose/10 text-neon-rose border border-neon-rose/20 glow-rose">
            <Gauge className="h-2.5 w-2.5" />
            {activeTicker}
            <button onClick={onClearTicker} className="ml-0.5 text-neon-rose/60 hover:text-neon-rose">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        )}
        <span className="text-muted-foreground/40 uppercase tracking-widest">F1 ENGINE</span>
      </div>
    </div>
  );
}

export default function Chat() {
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [randomSuggestions] = useState(() => getRandomSuggestions(4));
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<string | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const loadSessions = async () => {
      const { data } = await supabase
        .from("advisor_chat_history")
        .select("session_id, content, created_at")
        .eq("role", "user")
        .order("created_at", { ascending: false });

      if (data) {
        const seen = new Set<string>();
        const unique: ChatSession[] = [];
        for (const row of data) {
          if (row.session_id && !seen.has(row.session_id)) {
            seen.add(row.session_id);
            unique.push({
              session_id: row.session_id,
              preview: (row.content || "").substring(0, 60),
              created_at: row.created_at || "",
            });
          }
        }
        setSessions(unique.slice(0, 20));

        if (!initialLoadDone && unique.length > 0) {
          setInitialLoadDone(true);
          const lastSid = unique[0].session_id;
          setSessionId(lastSid as any);
          loadSession(lastSid);
        } else {
          setInitialLoadDone(true);
        }
      } else {
        setInitialLoadDone(true);
      }
    };
    loadSessions();
  }, [messages.length]);

  const loadSession = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("advisor_chat_history")
      .select("*")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const loaded: ChatMessage[] = data.map((row) => ({
        id: row.id,
        role: (row.role as "user" | "assistant") || "user",
        content: row.content || "",
        sources: row.sources ? (row.sources as any[]) : [],
      }));
      setMessages(loaded);
    }
  }, []);

  const persistMessage = async (
    msg: ChatMessage,
    sid: string,
    filters?: Record<string, string>
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("advisor_chat_history").insert({
      session_id: sid,
      role: msg.role,
      content: msg.content,
      sources: msg.sources ? (msg.sources as any) : null,
      filters: filters ? (filters as any) : null,
      user_id: user?.id,
    });
  };

  const handleNewChat = () => {
    setSessionId(generateSessionId());
    setMessages([]);
    setExpandedSources({});
    setShowHistory(false);
    setActivePortfolio(null);
    setActiveTicker(null);
  };

  const handleSelectSession = (sid: string) => {
    setSessionId(sid as `${string}-${string}-${string}-${string}-${string}`);
    setMessages([]);
    loadSession(sid);
    setShowHistory(false);
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;

    const detected = detectPortfolio(msg);
    if (detected) {
      setActivePortfolio(detected);
      setActiveTicker(null);
    }

    const detectedTicker = detectTicker(msg);
    if (detectedTicker && !detected) {
      setActiveTicker(detectedTicker);
    }

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsLoading(true);

    const filter_type = "all";
    const currentPortfolio = detected || activePortfolio;
    const currentTicker = detectedTicker || activeTicker;

    await persistMessage(newMsg, sessionId, { filter_type });

    const assistantId = (Date.now() + 1).toString();
    let fullContent = "";
    let sources: ChatSource[] = [];
    let toolCalls: ToolCallData[] = [];

    const sendStart = performance.now();

    try {
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query: msg, filter_type, session_id: sessionId, active_portfolio: currentPortfolio || undefined, active_ticker: currentTicker || undefined }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", sources: [], toolCalls: [], toolPending: null }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let firstTokenReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "delta" && event.text) {
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                const ttft = Math.round(performance.now() - sendStart);
                setLastLatency(ttft);
              }
              fullContent += event.text;
              const snap = fullContent;
              const tcSnap = [...toolCalls];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: snap, toolCalls: tcSnap, toolPending: null } : m
                )
              );
            } else if (event.type === "tool_pending") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolPending: event.label || "Processando..." } : m
                )
              );
            } else if (event.type === "tool_call") {
              toolCalls.push({ tool: event.tool, input: event.input });
              const snap = fullContent;
              const tcSnap = [...toolCalls];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: snap, toolCalls: tcSnap, toolPending: null } : m
                )
              );
            } else if (event.type === "sources") {
              sources = event.sources || [];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources, toolPending: null } : m
                )
              );
            }
          } catch {
            // partial JSON, ignore
          }
        }
      }

      await persistMessage(
        { id: assistantId, role: "assistant", content: fullContent, sources },
        sessionId
      );
    } catch (err) {
      console.error("Chat error:", err);
      const errorContent = "Erro ao processar sua pergunta. Tente novamente.";
      setMessages((prev) => {
        const hasAssistant = prev.some((m) => m.id === assistantId);
        if (hasAssistant) {
          return prev.map((m) =>
            m.id === assistantId ? { ...m, content: errorContent } : m
          );
        }
        return [...prev, { id: assistantId, role: "assistant", content: errorContent, sources: [] }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderToolCall = (tc: ToolCallData, idx: number) => {
    if (tc.tool === "renderizar_grafico_barras" && tc.input) {
      return <InlineBarChart key={idx} title={tc.input.title || ""} data={tc.input.data || []} bars={tc.input.bars || []} yAxisLabel={tc.input.yAxisLabel} />;
    }
    if (tc.tool === "renderizar_flash_factsheet" && tc.input) {
      return <FlashFactsheet key={idx} assetName={tc.input.assetName || ""} ticker={tc.input.ticker} assetClass={tc.input.assetClass || ""} portfolios={tc.input.portfolios || []} radarMetrics={tc.input.radarMetrics || []} thesis={tc.input.thesis || ""} />;
    }
    if (tc.tool === "renderizar_grafico_alocacao" && tc.input) {
      return <InlineDonutChart key={idx} title={tc.input.title || "Alocação por Classe de Ativo"} portfolio={tc.input.portfolio || ""} data={tc.input.data || []} />;
    }
    if (tc.tool === "renderizar_tabela_comparativa" && tc.input) {
      return <InlineComparisonTable key={idx} title={tc.input.title || ""} columns={tc.input.columns || []} rows={tc.input.rows || []} footerRow={tc.input.footerRow} />;
    }
    return null;
  };

  return (
    <Layout>
      <div className="flex h-screen bg-background">
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-52 border-r border-white/5 glass-card flex flex-col shrink-0">
            <div className="px-3 pt-4 pb-2">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 text-[10px] text-foreground hover:bg-white/[0.04] rounded-xl px-3 py-2 transition-colors w-full font-mono uppercase tracking-widest"
              >
                <SquarePen className="h-3 w-3 text-neon-orange" strokeWidth={1.5} />
                <span>New Session</span>
              </button>
            </div>

            <div className="px-3 pt-2 pb-1">
              <h3 className="text-[9px] font-semibold text-neon-orange uppercase tracking-[0.2em] font-mono">Sessions</h3>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] transition-colors truncate font-mono ${
                    s.session_id === sessionId
                      ? "glass-card text-neon-green font-medium border border-neon-green/20"
                      : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                  }`}
                >
                  {s.preview || "Untitled session"}
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-[9px] text-muted-foreground/40 px-3 py-4 text-center font-mono uppercase tracking-widest">No sessions</p>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Telemetry Bar */}
          <TelemetryBar
            isStreaming={isLoading}
            activeModel="Gemini 2.5 Flash"
            latency={lastLatency}
            activePortfolio={activePortfolio}
            activeTicker={activeTicker}
            onClearPortfolio={() => setActivePortfolio(null)}
            onClearTicker={() => setActiveTicker(null)}
          />

          {/* Header */}
          <div className="h-9 border-b border-white/5 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                title={showHistory ? "Hide history" : "Show history"}
              >
                {showHistory ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
              </button>
              <img src="/galapagos-logo.png" alt="Galapagos" className="h-4 w-4 object-contain" />
              <span className="text-[11px] font-semibold text-foreground tracking-wide">Galapagos RIA</span>
              <span className="text-[9px] text-muted-foreground/50 font-mono tracking-widest uppercase">Advisor Chat</span>
            </div>
          </div>

          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
              <div className="max-w-xl w-full text-center animate-fade-up">
                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full glass-card border border-neon-green/20">
                  <Zap className="h-3.5 w-3.5 text-neon-green" />
                  <span className="text-[10px] font-mono text-neon-green uppercase tracking-widest">F1 Engine Active</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                  Advisor Intelligence
                </h1>
                <p className="text-[10px] text-muted-foreground mb-8 font-mono uppercase tracking-widest">
                  Model Portfolios · RAG · Real-time Research
                </p>
                <div className="grid grid-cols-2 gap-2.5 stagger-children">
                  {randomSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left p-3.5 rounded-xl glass-card glass-card-hover text-[11px] text-muted-foreground hover:text-foreground transition-all duration-200 border border-transparent hover:border-neon-green/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5 bg-background" ref={messagesEndRef}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`}>
                  <div
                    className={`max-w-4xl w-full text-[12px] leading-[1.75] ${
                      msg.role === "user"
                        ? "glass-card text-foreground rounded-xl px-4 py-2.5 border border-white/5"
                        : "text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        {msg.content && (() => {
                          const { cleanContent, followUps } = extractFollowUps(msg.content);
                          return (
                            <>
                              <div className="prose prose-invert prose-sm max-w-none text-foreground/80 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:text-foreground [&_strong]:font-semibold [&_h1]:text-[14px] [&_h2]:text-[13px] [&_h3]:text-[12px] [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-2 [&_h1]:mb-1.5 [&_h2]:mb-1.5 [&_h3]:mb-1 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:text-foreground/70 [&_hr]:my-2.5 [&_hr]:border-white/5 [&_code]:font-mono [&_code]:text-neon-green [&_code]:text-[11px]">
                                <ReactMarkdown>{cleanContent}</ReactMarkdown>
                              </div>
                              {followUps.length > 0 && (
                                <div className="mt-2.5 flex flex-col gap-1">
                                  {followUps.map((q, i) => (
                                    <button
                                      key={i}
                                      onClick={() => handleSend(q)}
                                      disabled={isLoading}
                                      className="text-left px-2.5 py-1 rounded-lg text-[10px] text-neon-green glass-card border border-neon-green/10 hover:bg-neon-green/5 hover:border-neon-green/20 transition-colors disabled:opacity-50 leading-snug font-mono"
                                    >
                                      {q}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="mt-2">
                            {msg.toolCalls.map((tc, i) => renderToolCall(tc, i))}
                          </div>
                        )}
                        {msg.toolPending && (
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-neon-orange glass-card rounded-lg px-2.5 py-1.5 animate-pulse font-mono border border-neon-orange/20">
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            <span>{msg.toolPending}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap font-mono text-[11px]">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && (msg.content || (msg.toolCalls && msg.toolCalls.length > 0)) && (
                      <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/5">
                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedSources((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                            }
                            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors mr-1 font-mono uppercase tracking-widest"
                          >
                            {expandedSources[msg.id] ? (
                              <ChevronDown className="h-2.5 w-2.5" />
                            ) : (
                              <ChevronRight className="h-2.5 w-2.5" />
                            )}
                            Sources ({msg.sources.length})
                          </button>
                        )}
                        <div className="flex items-center gap-0.5 ml-auto">
                          <button onClick={() => {}} className="p-1 rounded text-muted-foreground hover:text-neon-green hover:bg-neon-green/5 transition-colors" title="Useful">
                            <ThumbsUp className="h-2.5 w-2.5" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => {}} className="p-1 rounded text-muted-foreground hover:text-neon-rose hover:bg-neon-rose/5 transition-colors" title="Not useful">
                            <ThumbsDown className="h-2.5 w-2.5" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => {
                              const lastUserMsg = messages.slice(0, messages.indexOf(msg)).reverse().find(m => m.role === "user");
                              if (lastUserMsg) handleSend(lastUserMsg.content);
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-neon-orange hover:bg-neon-orange/5 transition-colors" title="Regenerate"
                          >
                            <RefreshCw className="h-2.5 w-2.5" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Copy">
                            <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.role === "assistant" && expandedSources[msg.id] && msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.sources.map((src, i) => (
                          src.file_url ? (
                            <a key={i} href={src.file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center px-2 py-0.5 rounded-md glass-card text-[9px] text-neon-green border border-neon-green/10 hover:bg-neon-green/5 transition-colors cursor-pointer font-mono">
                              {src.name} · {src.period}
                            </a>
                          ) : (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md glass-card text-[9px] text-muted-foreground font-mono">
                              {src.name} · {src.period}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && !messages.some(m => m.id && m.role === "assistant" && m.content === "" && m.toolPending) && (
                <div className="flex justify-start animate-fade-up">
                  <div className="glass-card rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-[pulse_1s_ease-in-out_infinite]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/5 p-3 bg-card/40 backdrop-blur-sm">
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors shrink-0 ${showHistory ? 'text-neon-green bg-neon-green/10 border border-neon-green/20' : 'text-muted-foreground glass-card hover:text-foreground hover:bg-white/[0.04]'}`}
                title="Chat history"
              >
                <History className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about portfolios, assets, or performance..."
                rows={1}
                className="flex-1 resize-none glass-card rounded-lg px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-neon-green/30 font-mono text-[11px] border border-white/5"
              />
              <button
                onClick={() => handleSend()}
                className="h-10 w-10 rounded-lg bg-neon-green/90 text-primary-foreground flex items-center justify-center hover:bg-neon-green transition-colors shrink-0 glow-green"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
