import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ArtifactData } from "@/components/chat/ArtifactPanel";

function detectArtifactFromContent(content: string): ArtifactData | null {
  if (!content || content.length < 200) return null;
  const headerCount = (content.match(/^#{1,3}\s+.+$/gm) || []).length;
  const tableRowCount = (content.match(/^\|.+\|$/gm) || []).length;
  const formalSections = [
    "resumo executivo", "performance", "composição", "composicao",
    "análise de risco", "analise de risco", "conclusão", "conclusao",
    "recomendação", "recomendacao", "metodologia", "cenário", "cenario",
    "retorno", "alocação", "alocacao", "carteira", "fundo",
    "portfólio", "portfolio", "gestão", "gestao", "estratégia", "estrategia",
  ];
  const lower = content.toLowerCase();
  const formalHits = formalSections.filter(s => lower.includes(s)).length;
  const isArtifact = headerCount >= 2 || tableRowCount >= 3 || formalHits >= 2 || (content.length >= 800 && headerCount >= 1);
  if (!isArtifact) return null;
  const firstHeader = content.match(/^#{1,3}\s+(.+)$/m);
  const title = firstHeader ? firstHeader[1].trim() : "Relatório";
  const artifact_type = formalHits >= 2 ? "analysis" : "report";
  return { title, content, artifact_type };
}

export interface ChatSource {
  name: string;
  period: string;
  file_url?: string | null;
}

export interface ToolCallData {
  tool: string;
  input: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  toolCalls?: ToolCallData[];
  modelUsed?: "sonnet" | "opus";
  artifact?: ArtifactData;
}

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("advisor_chat_history")
      .select("id, role, content, sources")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      setMessages(
        data.map((row: any) => {
          const content = row.content || "";
          const role = row.role as "user" | "assistant";
          return {
            id: row.id,
            role,
            content,
            sources: row.sources ? (row.sources as any[]) : [],
            artifact: role === "assistant" ? detectArtifactFromContent(content) ?? undefined : undefined,
          };
        })
      );
    }
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    loadSession,
    clearMessages,
  };
}
