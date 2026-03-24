import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatSession {
  session_id: string;
  preview: string;
  created_at: string;
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => crypto.randomUUID());
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const loadSessions = useCallback(async () => {
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
      return unique;
    }
    return [];
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await supabase
      .from("advisor_chat_history")
      .delete()
      .eq("session_id", sessionId);
    setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
  }, []);

  const startNewSession = useCallback(() => {
    const newId = crypto.randomUUID();
    setCurrentSessionId(newId);
    return newId;
  }, []);

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    initialLoadDone,
    setInitialLoadDone,
    loadSessions,
    deleteSession,
    startNewSession,
  };
}
