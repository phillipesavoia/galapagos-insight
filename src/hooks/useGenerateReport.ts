import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PPTX_SERVICE_URL = "https://43ed6015-f502-4d2f-8f81-efec12377521-00-14er4jw3ws1x8.riker.replit.dev";
const PPTX_API_KEY = "GalapagosKey2026";

async function extractAttribution(portfolio: string): Promise<{ asset: string; contribution_pp: number }[]> {
  try {
    // 1. Fetch attribution chunks from the relatório de gestão
    const { data: chunks, error } = await supabase
      .from("document_chunks")
      .select("content, chunk_index, document_id")
      .in("chunk_index", [7, 8])
      .filter(
        "document_id",
        "in",
        `(${(
          await supabase
            .from("documents")
            .select("id")
            .eq("period", "2026-02")
            .eq("type", "relatorio")
        ).data?.map((d) => d.id).join(",") || ""})`
      )
      .order("chunk_index", { ascending: true });

    if (error || !chunks || chunks.length === 0) {
      console.warn("No attribution chunks found, using fallback");
      return [];
    }

    const rawText = chunks.map((c) => c.content).join("\n\n");

    // 2. Call the chat edge function to extract structured attribution
    const { data: sessionData } = await supabase.auth.getSession();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const prompt = `From the following investment report text, extract the top contributors and bottom contributors (attribution in pp) for the ${portfolio} portfolio only. Return ONLY a valid JSON array with this exact format, no explanation, no markdown:\n\n[{"asset": "DTLA", "contribution_pp": 1.04}, {"asset": "KWEB", "contribution_pp": -0.04}]\n\nPositive values = contributors, negative = detractors. Include ALL assets mentioned for this portfolio (both top and bottom).\n\nText:\n${rawText}`;

    const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        query: prompt,
        session_id: crypto.randomUUID(),
        filters: {},
      }),
    });

    if (!res.ok) {
      console.warn("Chat edge function failed:", res.status);
      return [];
    }

    // 3. Parse SSE stream to get the full text response
    const reader = res.body?.getReader();
    if (!reader) return [];

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === "delta" && json.text) {
            fullText += json.text;
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }

    // 4. Extract JSON array from the response
    const jsonMatch = fullText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.warn("No JSON array found in response:", fullText.substring(0, 200));
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn("Attribution extraction failed, using fallback:", err);
    return [];
  }
}

export function useGenerateReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport(payload: { portfolio: string; month: string; data: Record<string, unknown> }) {
    setIsGenerating(true);
    setError(null);
    try {
      // Extract attribution dynamically from RAG
      const portfolioName = payload.portfolio.charAt(0).toUpperCase() + payload.portfolio.slice(1);
      const attribution = await extractAttribution(portfolioName);

      const enrichedPayload = {
        ...payload,
        data: {
          ...payload.data,
          attribution,
        },
      };

      const response = await fetch(`${PPTX_SERVICE_URL}/generate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": PPTX_API_KEY },
        body: JSON.stringify(enrichedPayload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `galapagos_${payload.portfolio}_${payload.month.replace(/\s+/g, "_")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsGenerating(false);
    }
  }
  return { generateReport, isGenerating, error };
}
