import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, RefreshCw, Copy } from "lucide-react";
import { InlineBarChart } from "@/components/chat/InlineBarChart";
import { FlashFactsheet } from "@/components/chat/FlashFactsheet";
import InlineReturnsTable from "@/components/chat/InlineReturnsTable";
import InlineLineChart from "@/components/chat/InlineLineChart";
import InlinePieChart from "@/components/chat/InlinePieChart";
import type { ChatMessage, ToolCallData } from "@/hooks/useChatMessages";

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

function renderToolCall(tc: ToolCallData, idx: number) {
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
        weightsByPortfolio={tc.input.weightsByPortfolio}
        radarMetrics={tc.input.radarMetrics || []}
        thesis={tc.input.thesis || ""}
      />
    );
  }
  if (tc.tool === "renderizar_tabela_retornos" && tc.input) {
    return (
      <InlineReturnsTable
        key={idx}
        title={tc.input.title || ""}
        columns={tc.input.columns || []}
        rows={tc.input.rows || []}
        colorize={tc.input.colorize}
      />
    );
  }
  if (tc.tool === "renderizar_grafico_linha" && tc.input) {
    return (
      <InlineLineChart
        key={idx}
        title={tc.input.title || ""}
        data={tc.input.data || []}
        lines={tc.input.lines || []}
        yAxisLabel={tc.input.yAxisLabel}
      />
    );
  }
  if (tc.tool === "renderizar_pie_chart" && tc.input) {
    return (
      <InlinePieChart
        key={idx}
        title={tc.input.title || ""}
        data={tc.input.data || []}
        donut={tc.input.donut}
      />
    );
  }
  return null;
}

interface Props {
  message: ChatMessage;
  isLastMessage: boolean;
  isLoading: boolean;
  allMessages: ChatMessage[];
  expandedSources: Record<string, boolean>;
  onToggleSource: (id: string) => void;
  onSend: (text: string) => void;
  onRegenerate: (content: string) => void;
}

export function ChatMessageItem({
  message: msg,
  isLastMessage,
  isLoading,
  allMessages,
  expandedSources,
  onToggleSource,
  onSend,
  onRegenerate,
}: Props) {
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-4xl w-full text-[13px] leading-[1.7] ${
          msg.role === "user"
            ? "rounded-2xl border border-border bg-secondary px-4 py-3 text-foreground"
            : "text-foreground"
        }`}
      >
        {msg.role === "assistant" && msg.modelUsed && (
          <span
            className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide mb-1.5 ${
              msg.modelUsed === "opus"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
            }`}
            title={msg.modelUsed === "opus" ? "Claude Opus" : "Claude Sonnet"}
          >
            {msg.modelUsed === "opus" ? "O" : "S"}
          </span>
        )}
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
                          onClick={() => onSend(q)}
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
              onClick={() => onToggleSource(msg.id)}
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
          <>
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
                  const lastUserMsg = allMessages.slice(0, allMessages.indexOf(msg)).reverse().find(m => m.role === "user");
                  if (lastUserMsg) onRegenerate(lastUserMsg.content);
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
          </>
        )}
      </div>
    </div>
  );
}
