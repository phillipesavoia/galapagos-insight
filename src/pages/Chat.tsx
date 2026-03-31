import { useState, useEffect, useRef } from "react";
import { Send, PanelLeftClose, PanelLeft, History } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChatMessages, type ChatSource, type ToolCallData, type ChatMessage } from "@/hooks/useChatMessages";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { ChatSessionSidebar } from "@/components/chat/ChatSessionSidebar";

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

export default function Chat() {
  const {
    sessions, setSessions, currentSessionId, setCurrentSessionId,
    initialLoadDone, setInitialLoadDone, loadSessions, deleteSession, startNewSession
  } = useChatSessions();

  const {
    messages, setMessages, isLoading, setIsLoading, loadSession, clearMessages
  } = useChatMessages();

  const [menuOpenSession, setMenuOpenSession] = useState<string | null>(null);
  const [webSearching, setWebSearching] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(true);
  const [randomSuggestions] = useState(() => getRandomSuggestions(4));
  const [filterType, setFilterType] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const init = async () => {
      const unique = await loadSessions();
      if (!initialLoadDone) {
        setInitialLoadDone(true);
        if (unique.length > 0) {
          const lastSid = unique[0].session_id;
          setCurrentSessionId(lastSid);
          loadSession(lastSid);
        }
      }
    };
    init();
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
    startNewSession();
    clearMessages();
    setExpandedSources({});
    setShowHistory(false);
  };

  const handleClearAllChats = async () => {
    if (!confirm("Tem certeza que deseja apagar todo o histórico de conversas?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("advisor_chat_history").delete().eq("user_id", user.id);
    setSessions([]);
    clearMessages();
    startNewSession();
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenSession(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("advisor_chat_history").delete().eq("session_id", sid).eq("user_id", user.id);
    setSessions((prev) => prev.filter((s) => s.session_id !== sid));
    if (currentSessionId === sid) {
      clearMessages();
      startNewSession();
    }
  };

  const handleSelectSession = (sid: string) => {
    setCurrentSessionId(sid);
    clearMessages();
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
    setWebSearching(null);

    const filter_type = filterType;

    await persistMessage(newMsg, currentSessionId, { filter_type });

    const assistantId = (Date.now() + 1).toString();
    let fullContent = "";
    let sources: ChatSource[] = [];
    let toolCalls: ToolCallData[] = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query: msg, filter_type, session_id: currentSessionId }),
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
        currentSessionId
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

  return (
    <Layout>
      <div className="flex h-screen bg-background text-foreground">
        {showHistory && (
          <ChatSessionSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            menuOpenSession={menuOpenSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onNewChat={handleNewChat}
            onClearAll={handleClearAllChats}
            onSetMenuOpen={setMenuOpenSession}
          />
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
            <div className="flex items-center gap-1">
              {[
                { label: "Todos", value: "all" },
                { label: "Factsheets", value: "factsheet" },
                { label: "Apresentações", value: "apresentacao" },
                { label: "Cartas", value: "carta_mensal" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterType(f.value)}
                  className={`px-2 py-0.5 rounded-md text-[10px] transition-colors ${
                    filterType === f.value
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  isLastMessage={msg.id === messages[messages.length - 1]?.id}
                  isLoading={isLoading}
                  allMessages={messages}
                  expandedSources={expandedSources}
                  onToggleSource={(id) => setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }))}
                  onSend={(text) => handleSend(text)}
                  onRegenerate={(text) => handleSend(text)}
                />
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
