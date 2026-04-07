import { useState } from "react";

const PPTX_SERVICE_URL = "https://43ed6015-f502-4d2f-8f81-efec12377521-00-14er4jw3ws1x8.riker.replit.dev";
const PPTX_API_KEY = "GalapagosKey2026";

export function useGenerateReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport(payload: { portfolio: string; month: string; data: Record<string, unknown>; }) {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`${PPTX_SERVICE_URL}/generate-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": PPTX_API_KEY },
        body: JSON.stringify(payload),
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
