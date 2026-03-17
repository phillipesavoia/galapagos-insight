import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ChevronDown, ChevronRight, X, Plus, History, ThumbsUp, ThumbsDown, RefreshCw, Copy, PanelLeftClose, PanelLeft, SquarePen } from "lucide-react";
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
          <div className="w-56 border-r border-white/5 glass-card flex flex-col shrink-0">
            <div className="px-3 pt-5 pb-2">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2.5 text-xs text-foreground hover:bg-white/[0.04] rounded-xl px-3 py-2.5 transition-colors w-full font-mono"
              >
                <SquarePen className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>New chat</span>
              </button>
            </div>

            <div className="px-3 pt-3 pb-2">
              <h3 className="text-[9px] font-semibold text-neon-orange uppercase tracking-widest font-mono">History</h3>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[11px] transition-colors truncate ${
                    s.session_id === sessionId
                      ? "glass-card text-neon-green font-medium border-neon-green/20"
                      : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                  }`}
                >
                  {s.preview || "Conversa sem título"}
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 px-3 py-4 text-center font-mono">No previous chats.</p>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Fixed header */}
          <div className="h-10 border-b border-white/5 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                title={showHistory ? "Hide history" : "Show history"}
              >
                {showHistory ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </button>
              <img src="/galapagos-logo.png" alt="Galapagos" className="h-5 w-5 object-contain" />
              <span className="text-xs font-semibold text-foreground tracking-wide">Galapagos RIA</span>
              <span className="text-[9px] text-muted-foreground font-mono tracking-widest uppercase">Offshore</span>
            </div>
            <div className="flex items-center gap-2">
              {activePortfolio && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-medium bg-neon-green/10 text-neon-green border border-neon-green/20">
                  📍 {activePortfolio}
                  <button onClick={() => setActivePortfolio(null)} className="ml-0.5 text-neon-green/60 hover:text-neon-green">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {activeTicker && !activePortfolio && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                  📍 {activeTicker}
                  <button onClick={() => setActiveTicker(null)} className="ml-0.5 text-primary/60 hover:text-primary">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <span className="text-[9px] text-muted-foreground/50 font-mono uppercase tracking-widest">Advisor Chat</span>
            </div>
          </div>

          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
              <div className="max-w-xl w-full text-center animate-fade-up">
                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                  What do you want to know about our funds?
                </h1>
                <p className="text-xs text-muted-foreground mb-8 font-mono uppercase tracking-widest">
                  Searching indexed document base to answer
                </p>
                <div className="grid grid-cols-2 gap-3 stagger-children">
                  {randomSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left p-4 rounded-2xl glass-card glass-card-hover text-xs text-muted-foreground hover:text-foreground transition-all duration-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6 space-y-6 bg-background" ref={messagesEndRef}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-4xl w-full text-[13px] leading-[1.7] ${
                      msg.role === "user"
                        ? "glass-card text-foreground rounded-2xl px-4 py-3"
                        : "text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        {msg.content && (() => {
                          const { cleanContent, followUps } = extractFollowUps(msg.content);
                          return (
                            <>
                              <div className="prose prose-invert prose-sm max-w-none text-foreground/80 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-foreground [&_strong]:font-semibold [&_h1]:text-[15px] [&_h2]:text-[14px] [&_h3]:text-[13px] [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_h1]:mt-4 [&_h2]:mt-4 [&_h3]:mt-3 [&_h1]:mb-2 [&_h2]:mb-2 [&_h3]:mb-1 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:text-foreground/70 [&_hr]:my-3 [&_hr]:border-white/5">
                                <ReactMarkdown>{cleanContent}</ReactMarkdown>
                              </div>
                              {followUps.length > 0 && (
                                <div className="mt-3 flex flex-col gap-1.5">
                                  {followUps.map((q, i) => (
                                    <button
                                      key={i}
                                      onClick={() => handleSend(q)}
                                      disabled={isLoading}
                                      className="text-left px-3 py-1.5 rounded-xl text-xs text-neon-green glass-card border-neon-green/10 hover:bg-neon-green/5 hover:border-neon-green/20 transition-colors disabled:opacity-50 leading-snug font-mono"
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
                          <div className="mt-3 flex items-center gap-2 text-xs text-neon-green glass-card rounded-xl px-3 py-2 animate-pulse font-mono">
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            <span>{msg.toolPending}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.role === "assistant" && (msg.content || (msg.toolCalls && msg.toolCalls.length > 0)) && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedSources((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                            }
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mr-1 font-mono"
                          >
                            {expandedSources[msg.id] ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            Sources ({msg.sources.length})
                          </button>
                        )}
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => {}} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Useful">
                            <ThumbsUp className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => {}} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Not useful">
                            <ThumbsDown className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => {
                              const lastUserMsg = messages.slice(0, messages.indexOf(msg)).reverse().find(m => m.role === "user");
                              if (lastUserMsg) handleSend(lastUserMsg.content);
                            }}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Regenerate"
                          >
                            <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => navigator.clipboard.writeText(msg.content)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Copy">
                            <Copy className="h-3 w-3" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.role === "assistant" && expandedSources[msg.id] && msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.sources.map((src, i) => (
                          src.file_url ? (
                            <a key={i} href={src.file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1 rounded-xl glass-card text-[10px] text-neon-green border-neon-green/10 hover:bg-neon-green/5 transition-colors cursor-pointer font-mono">
                              {src.name} · {src.period}
                            </a>
                          ) : (
                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-xl glass-card text-[10px] text-muted-foreground font-mono">
                              {src.name} · {src.period}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-fade-up">
                  <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-neon-green animate-[pulse_1s_ease-in-out_infinite]" />
                    <span className="h-2 w-2 rounded-full bg-neon-green animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                    <span className="h-2 w-2 rounded-full bg-neon-green animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/5 p-4 bg-background/80 backdrop-blur-sm">
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors shrink-0 ${showHistory ? 'text-neon-green bg-neon-green/10 border border-neon-green/20' : 'text-muted-foreground glass-card hover:text-foreground hover:bg-white/[0.04]'}`}
                title="Chat history"
              >
                <History className="h-4 w-4" strokeWidth={1.5} />
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
                placeholder="Ask about funds, theses or performance..."
                rows={1}
                className="flex-1 resize-none glass-card rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono text-xs"
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
      </div>
    </Layout>
  );
}
