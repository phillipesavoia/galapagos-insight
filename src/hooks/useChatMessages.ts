import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ArtifactData } from "@/components/chat/ArtifactPanel";

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
        data.map((row: any) => ({
          id: row.id,
          role: row.role as "user" | "assistant",
          content: row.content || "",
          sources: row.sources ? (row.sources as any[]) : [],
        }))
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
