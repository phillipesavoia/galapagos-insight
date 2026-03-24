import { Trash2, MoreHorizontal, SquarePen } from "lucide-react";
import type { ChatSession } from "@/hooks/useChatSessions";

interface Props {
  sessions: ChatSession[];
  currentSessionId: string;
  menuOpenSession: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onNewChat: () => void;
  onClearAll: () => void;
  onSetMenuOpen: (id: string | null) => void;
}

export function ChatSessionSidebar({
  sessions,
  currentSessionId,
  menuOpenSession,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onClearAll,
  onSetMenuOpen,
}: Props) {
  return (
    <div className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 pt-5 pb-2">
        <button
          onClick={onNewChat}
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
          <div
            key={s.session_id}
            className={`group relative flex items-center rounded-full transition-colors ${
              s.session_id === currentSessionId
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <button
              onClick={() => onSelectSession(s.session_id)}
              className="flex-1 min-w-0 truncate px-3 py-2 text-left text-[13px]"
            >
              {s.preview || "Conversa sem título"}
            </button>
            <div className="relative shrink-0 pr-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetMenuOpen(menuOpenSession === s.session_id ? null : s.session_id);
                }}
                className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
                title="Opções"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpenSession === s.session_id && (
                <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-card shadow-lg py-1">
                  <button
                    onClick={(e) => onDeleteSession(s.session_id, e)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir chat
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma conversa anterior.</p>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onClearAll}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Apagar histórico</span>
          </button>
        </div>
      )}
    </div>
  );
}
