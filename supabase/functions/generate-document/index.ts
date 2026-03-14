import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, client_name, period, funds, tone, macro_context, recipient } = await req.json();

    const dbUrl = Deno.env.get("DB_URL");
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!dbUrl || !dbKey || !anthropicKey) throw new Error("Missing env vars");

    const supabase = createClient(dbUrl, dbKey);

    let chunks: any[] = [];
    if (funds && funds.length > 0) {
      for (const fund of funds.slice(0, 3)) {
        const { data } = await supabase
          .from("document_chunks")
          .select("content, metadata, document_id")
          .ilike("metadata->>fund_name", `%${fund}%`)
          .limit(4);
        if (data) chunks.push(...data);
      }
    }

    if (chunks.length === 0) {
      const { data } = await supabase
        .from("document_chunks")
        .select("content, metadata, document_id")
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) chunks = data;
    }

    const context = chunks.map((c: any) =>
      `[${c.metadata?.fund_name || ""} | ${c.metadata?.period || ""}]\n${c.content}`
    ).join("\n\n---\n\n");

    let prompt = "";

    if (type === "carta_mensal") {
      const toneMap: Record<string, string> = {
        "Neutro": "neutro e equilibrado",
        "Otimista": "otimista e construtivo",
        "Cauteloso": "cauteloso e conservador",
      };
      prompt = `Você é um gestor de investimentos sênior da Galapagos Capital Advisory.
Escreva uma carta mensal profissional para o cliente ${client_name || "Prezado Cliente"} 
referente ao período ${period || "recente"}.

Tom desejado: ${toneMap[tone] || "neutro"}
Fundos em destaque: ${(funds || []).join(", ") || "portfólio geral"}
Contexto macro adicional: ${macro_context || "sem contexto adicional"}

Informações dos documentos indexados:
${context || "Sem documentos disponíveis — use conhecimento geral sobre mercados."}

Escreva a carta em português brasileiro com:
1. Saudação personalizada ao cliente
2. Resumo do cenário macroeconômico do período
3. Performance e destaques dos fundos mencionados
4. Perspectivas e posicionamento
5. Encerramento profissional com assinatura da Galapagos Capital Advisory

Formato: texto corrido, profissional, sem marcadores ou listas.`;

    } else if (type === "resumo_fundo") {
      const audienceMap: Record<string, string> = {
        "Cliente": "cliente final não técnico, linguagem acessível",
        "Assessor": "assessor de investimentos, linguagem técnica moderada",
        "Interno": "equipe interna, linguagem técnica completa",
      };
      prompt = `Escreva um resumo executivo do fundo ${(funds || [])[0] || "solicitado"} 
para ${audienceMap[recipient] || "cliente"}, referente ao período ${period || "recente"}.

Informações dos documentos indexados:
${context || "Sem documentos disponíveis."}

Inclua: objetivo do fundo, estratégia, performance, principais posições, riscos e adequação.
Escreva em português brasileiro, de forma clara e objetiva.`;

    } else if (type === "comparativo") {
      prompt = `Faça uma análise comparativa entre os fundos: ${(funds || []).join(", ")}.

Critério principal de comparação: ${tone || "retorno ajustado ao risco"}

Informações dos documentos indexados:
${context || "Sem documentos disponíveis."}

Estruture a comparação com:
1. Tabela comparativa (formato markdown) com retorno, risco, liquidez e correlação
2. Análise narrativa das diferenças e semelhanças
3. Recomendação de adequação por perfil de investidor

Escreva em português brasileiro, formato profissional.`;
    }

    // Call Claude with streaming
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) throw new Error(`Claude error: ${await claudeRes.text()}`);

    // Transform Claude's SSE stream into our own SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = claudeRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const evt = JSON.parse(data);
                if (evt.type === "content_block_delta" && evt.delta?.text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: evt.delta.text })}\n\n`));
                }
              } catch {
                // skip unparseable
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Generate error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
