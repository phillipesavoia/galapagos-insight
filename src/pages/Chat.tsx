import { useState, useEffect, useRef, useCallback } from "react";
import { Send, ChevronDown, ChevronRight, X, SlidersHorizontal, Plus, History, ThumbsUp, ThumbsDown, RefreshCw, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

const suggestions = [
  "Qual foi o drawdown máximo no último trimestre?",
  "Compare a performance YTD de todos os portfólios",
  "Como explicar nossa posição em crédito para um cliente conservador?",
  "Mostre os retornos mensais dos portfólios em gráfico",
];

const filterChips = ["Todos os documentos", "Factsheets", "Cartas Mensais", "Apresentações"];

function generateSessionId() {
  return crypto.randomUUID();
}

export default function Chat() {
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos os documentos");
  const [activeFund, setActiveFund] = useState("Todos");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showSourcesPanel, setShowSourcesPanel] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;
  const lastAssistantSources = [...messages].reverse().find((m) => m.role === "assistant")?.sources || [];

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

    const filterMap: Record<string, string> = {
      "Factsheets": "factsheet",
      "Cartas Mensais": "carta_mensal",
      "Apresentações": "apresentacao",
    };
    const filter_type = filterMap[activeFilter] || "all";

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
        body: JSON.stringify({ query: msg, filter_type, filter_fund: activeFund === "Todos" ? null : activeFund, session_id: sessionId }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      // Create initial assistant message
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
    return null;
  };

  return (
    <Layout>
      <div className="flex h-screen bg-white">
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Histórico</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-2">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova conversa
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                    s.session_id === sessionId
                      ? "bg-emerald-50 text-gray-900"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  {s.preview || "Conversa sem título"}
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2">Nenhuma conversa anterior.</p>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-white">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Histórico de conversas"
            >
              <History className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Nova conversa"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {isEmpty ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
              <div className="max-w-xl w-full text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">
                  Olá. O que você quer saber sobre os nossos fundos?
                </h1>
                <p className="text-sm text-gray-500 mb-8">
                  Pesquiso na base de documentos indexados para responder.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left p-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-emerald-300 hover:text-gray-900 transition-colors shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-5 bg-gray-100" ref={messagesEndRef}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-3xl px-5 py-4 rounded-2xl text-[13px] leading-[1.7] shadow-sm ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white border border-emerald-700"
                        : "bg-white border border-gray-300 text-gray-900"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        {msg.content && (
                          <div className="prose prose-sm max-w-none text-gray-800 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:text-gray-900 [&_strong]:font-semibold [&_h1]:text-[15px] [&_h2]:text-[14px] [&_h3]:text-[13px] [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_h1]:mt-4 [&_h2]:mt-4 [&_h3]:mt-3 [&_h1]:mb-2 [&_h2]:mb-2 [&_h3]:mb-1 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:text-gray-700 [&_hr]:my-3 [&_hr]:border-gray-200">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                        {/* Render tool call components (Generative UI) */}
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
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() =>
                            setExpandedSources((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
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
                                  className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 text-xs text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer"
                                >
                                  {src.name} · {src.period}
                                </a>
                              ) : (
                                <span
                                  key={i}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-600 border border-gray-200"
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
                      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => {/* TODO: feedback */}}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Útil"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => {/* TODO: feedback */}}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Não útil"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => {
                            const lastUserMsg = messages.slice(0, messages.indexOf(msg)).reverse().find(m => m.role === "user");
                            if (lastUserMsg) handleSend(lastUserMsg.content);
                          }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Regenerar"
                        >
                          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.content)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-[pulse_1s_ease-in-out_infinite]" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sources panel */}
          {showSourcesPanel && lastAssistantSources.length > 0 && !isEmpty && (
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Fontes utilizadas</h3>
                <button onClick={() => setShowSourcesPanel(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastAssistantSources.map((src, i) => (
                  <div key={i} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
                    {src.file_url ? (
                      <a href={src.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">{src.name}</a>
                    ) : (
                      <p className="text-xs font-medium text-gray-800">{src.name}</p>
                    )}
                    <p className="text-[10px] text-gray-500">{src.period}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex gap-2">
                {filterChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setActiveFilter(chip)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      activeFilter === chip
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-100 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-gray-200" />
              <select
                value={activeFund}
                onChange={(e) => setActiveFund(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-700 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
              >
                {["Todos", "Conservative", "Income", "Balanced", "Growth"].map((fund) => (
                  <option key={fund} value={fund}>{fund === "Todos" ? "Todos os Portfólios" : fund}</option>
                ))}
              </select>
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
                className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                onClick={() => handleSend()}
                className="h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shrink-0"
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Floating button to show sources if hidden */}
        {!showSourcesPanel && !isEmpty && lastAssistantSources.length > 0 && (
          <button
            onClick={() => setShowSourcesPanel(true)}
            className="fixed bottom-24 left-[280px] px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-md text-xs text-gray-600 hover:text-gray-900 transition-colors z-10"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 inline mr-1.5" strokeWidth={1.5} />
            Fontes
          </button>
        )}
      </div>
    </Layout>
  );
}
