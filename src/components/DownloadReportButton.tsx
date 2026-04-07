import { useGenerateReport } from "@/hooks/useGenerateReport";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";

interface Props {
  portfolio: string;
  month: string;
  data: Record<string, unknown>;
}

export function DownloadReportButton({ portfolio, month, data }: Props) {
  const { generateReport, isGenerating, error } = useGenerateReport();
  return (
    <div>
      <Button
        onClick={() => generateReport({ portfolio, month, data })}
        disabled={isGenerating}
        className="bg-[#173C82] hover:bg-[#0071BB] text-white gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            Download PPTX
          </>
        )}
      </Button>
      {error && <p className="text-sm text-destructive mt-2">Erro: {error}</p>}
    </div>
  );
}
