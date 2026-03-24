import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Auth validation ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, client_name, period, funds, tone, macro_context, recipient } = await req.json();

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

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

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.text();
      throw new Error(`Anthropic error: ${err}`);
    }

    // Pipe the SSE stream directly to the client
    return new Response(anthropicResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
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
