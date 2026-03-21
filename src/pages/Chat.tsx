import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, RefreshCw, Copy, PanelLeftClose, PanelLeft, SquarePen, History, Trash2, MoreHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { InlineBarChart } from "@/components/chat/InlineBarChart";
import { FlashFactsheet } from "@/components/chat/FlashFactsheet";

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
}

interface ChatSession {
  session_id: string;
  preview: string;
  created_at: string;
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

function normalizeMarkdownTables(content: string) {
  const lines = content.split("\n");
  const normalized: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const currentLine = lines[i];
    const trimmedCurrentLine = currentLine.trim();
    const previousMeaningfulLine = normalized.length > 0 ? normalized[normalized.length - 1].trim() : "";
    const nextMeaningfulLine = lines.slice(i + 1).find((line) => line.trim().length > 0)?.trim() ?? "";

    const isBlankLine = trimmedCurrentLine === "";
    const isInsideTable = previousMeaningfulLine.startsWith("|") && nextMeaningfulLine.startsWith("|");

    if (isBlankLine && isInsideTable) {
      continue;
    }

    normalized.push(currentLine);
  }

  return normalized.join("\n");
}

function generateSessionId() {
  return crypto.randomUUID();
}

export default function Chat() {
  const [menuOpenSession, setMenuOpenSession] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [randomSuggestions] = useState(() => getRandomSuggestions(4));
  const [initialLoadDone, setInitialLoadDone] = useState(false);
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
  };

  const handleClearAllChats = async () => {
    if (!confirm("Tem certeza que deseja apagar todo o histórico de conversas?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("advisor_chat_history").delete().eq("user_id", user.id);
    setSessions([]);
    setMessages([]);
    setSessionId(generateSessionId());
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

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsLoading(true);

    const filter_type = "all";

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
        body: JSON.stringify({ query: msg, filter_type, session_id: sessionId }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", sources: [], toolCalls: [] }]);

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
                  m.id === assistantId ? { ...m, content: snap, toolCalls: tcSnap } : m
                )
              );
            } else if (event.type === "tool_call") {
              toolCalls.push({ tool: event.tool, input: event.input });
              const snap = fullContent;
              const tcSnap = [...toolCalls];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: snap, toolCalls: tcSnap } : m
                )
              );
            } else if (event.type === "sources") {
              sources = event.sources || [];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources } : m
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
      return (
        <InlineBarChart
          key={idx}
          title={tc.input.title || ""}
          data={tc.input.data || []}
          bars={tc.input.bars || []}
          yAxisLabel={tc.input.yAxisLabel}
        />
      );
    }
    if (tc.tool === "renderizar_flash_factsheet" && tc.input) {
      return (
        <FlashFactsheet
          key={idx}
          assetName={tc.input.assetName || ""}
          ticker={tc.input.ticker}
          assetClass={tc.input.assetClass || ""}
          portfolios={tc.input.portfolios || []}
          radarMetrics={tc.input.radarMetrics || []}
          thesis={tc.input.thesis || ""}
        />
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="flex h-screen bg-background text-foreground">
        {showHistory && (
          <div className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
            <div className="px-4 pt-5 pb-2">
              <button
                onClick={handleNewChat}
                className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <SquarePen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span>New chat</span>
              </button>
            </div>

            <div className="px-4 pt-4 pb-2">
              <h3 className="text-xs font-medium text-muted-foreground">Chats</h3>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-0.5">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  className={`w-full truncate rounded-full px-3 py-2 text-left text-[13px] transition-colors ${
                    s.session_id === sessionId
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {s.preview || "Conversa sem título"}
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma conversa anterior.</p>
              )}
            </div>

            {sessions.length > 0 && (
              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={handleClearAllChats}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Apagar histórico</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex min-w-0 flex-col">
          <div className="h-10 shrink-0 border-b border-border bg-background flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={showHistory ? "Esconder histórico" : "Mostrar histórico"}
              >
                {showHistory ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </button>
              <img src="/galapagos-logo.png" alt="Galapagos" className="h-5 w-5 object-contain" />
              <span className="text-xs font-semibold tracking-wide text-foreground">Galapagos RIA</span>
              <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">Offshore</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Advisor Chat</span>
          </div>

          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
              <div className="max-w-xl w-full text-center">
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
                  Olá. O que você quer saber sobre os nossos fundos?
                </h1>
                <p className="mb-8 text-sm text-muted-foreground">
                  Pesquiso na base de documentos indexados para responder.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {randomSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-xl border border-border bg-card p-4 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
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
                        ? "rounded-2xl border border-border bg-secondary px-4 py-3 text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        {msg.content && (() => {
                          const { cleanContent, followUps } = extractFollowUps(msg.content);
                          const normalizedMarkdown = normalizeMarkdownTables(cleanContent);

                          return (
                            <>
                              <div className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_p]:text-foreground [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_li]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-[15px] [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:pl-5 [&_ol]:pl-5 [&_hr]:my-3 [&_hr]:border-border [&_code]:text-foreground">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    table: ({ children }) => (
                                      <div className="my-4 overflow-x-auto rounded-xl border border-border bg-card">
                                        <table className="w-full min-w-max border-collapse text-xs text-foreground">
                                          {children}
                                        </table>
                                      </div>
                                    ),
                                    thead: ({ children }) => (
                                      <thead className="border-b border-border bg-secondary text-primary">
                                        {children}
                                      </thead>
                                    ),
                                    th: ({ children }) => (
                                      <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-primary whitespace-nowrap">
                                        {children}
                                      </th>
                                    ),
                                    tbody: ({ children }) => (
                                      <tbody className="divide-y divide-border/70 bg-card text-foreground">
                                        {children}
                                      </tbody>
                                    ),
                                    tr: ({ children }) => (
                                      <tr className="transition-colors hover:bg-accent/40">
                                        {children}
                                      </tr>
                                    ),
                                    td: ({ children }) => {
                                      const text = String(children ?? "").trim();
                                      const isPositive = /^\+\d+(\.\d+)?%$/.test(text);
                                      const isNegative = /^-\d+(\.\d+)?%$/.test(text);
                                      const isNA = text === "N/A";

                                      return (
                                        <td
                                          className={[
                                            "px-3 py-2 align-top font-mono tabular-nums text-foreground whitespace-nowrap",
                                            isPositive && "text-primary font-medium",
                                            isNegative && "text-destructive font-medium",
                                            isNA && "text-muted-foreground",
                                          ].filter(Boolean).join(" ")}
                                        >
                                          {children}
                                        </td>
                                      );
                                    },
                                  }}
                                >
                                  {normalizedMarkdown}
                                </ReactMarkdown>
                              </div>
                              {followUps.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {followUps.map((q, i) => (
                                    <button
                                      key={i}
                                      onClick={() => handleSend(q)}
                                      disabled={isLoading}
                                      className="max-w-xs truncate rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent disabled:opacity-50"
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
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <button
                          onClick={() =>
                            setExpandedSources((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
                              src.file_url ? (
                                <a
                                  key={i}
                                  href={src.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent cursor-pointer"
                                >
                                  {src.name} · {src.period}
                                </a>
                              ) : (
                                <span
                                  key={i}
                                  className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                                >
                                  {src.name} · {src.period}
                                </span>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.role === "assistant" && (msg.content || (msg.toolCalls && msg.toolCalls.length > 0)) && (
                      <div className="flex items-center gap-1 mt-3 pt-2">
                        <button
                          onClick={() => {/* TODO: feedback */}}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="Útil"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => {/* TODO: feedback */}}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="Não útil"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => {
                            const lastUserMsg = messages.slice(0, messages.indexOf(msg)).reverse().find(m => m.role === "user");
                            if (lastUserMsg) handleSend(lastUserMsg.content);
                          }}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="Regenerar"
                        >
                          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.content)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="Copiar"
                        >
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary animate-[pulse_1s_ease-in-out_infinite]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border p-4 bg-background">
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors shrink-0 ${showHistory ? 'text-foreground bg-secondary border border-border' : 'text-muted-foreground bg-card border border-border hover:text-foreground hover:bg-accent'}`}
                title="Histórico de conversas"
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
                placeholder="Pergunte sobre fundos, teses ou performance..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => handleSend()}
                className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center transition-colors hover:opacity-90 shrink-0"
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
