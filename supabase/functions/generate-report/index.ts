import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { document_ids, period } = await req.json();

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "document_ids array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all chunks for provided documents, ordered by document and chunk index
    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("content, metadata, document_id, chunk_index")
      .in("document_id", document_ids)
      .order("document_id")
      .order("chunk_index", { ascending: true });

    if (chunksError) throw new Error("Failed to fetch chunks: " + chunksError.message);
    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content found. Make sure documents are fully indexed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch document metadata
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name, type, period")
      .in("id", document_ids);

    const docNames = (docs || []).map(d => d.name).join(" + ");
    const reportPeriod = period || (docs || [])[0]?.period || new Date().toISOString().slice(0, 7);
    const reportName = `Relatório de Gestão — ${reportPeriod}`;

    // Build full context from chunks
    const context = chunks
      .map(c => c.content)
      .filter(c => c && c.length > 20)
      .join("\n\n---\n\n");

    // Generate report with Claude
    const systemPrompt = `Você é um analista sênior da Galapagos Capital Advisory (Miami), especializado em gestão de portfólios offshore para clientes brasileiros de alto patrimônio.

Gere um relatório de gestão COMPLETO e DETALHADO em português brasileiro, baseado EXCLUSIVAMENTE no conteúdo das apresentações fornecidas.

REGRAS ABSOLUTAS:
- Use APENAS informações presentes no conteúdo fornecido — nunca invente dados
- Inclua TODOS os dados numéricos, percentuais e tabelas que encontrar
- Se um dado não estiver disponível no conteúdo, escreva "dado não disponível"
- Use linguagem técnica de mercado financeiro
- O relatório deve ser suficientemente completo para que um advisor possa responder qualquer pergunta de cliente sem consultar as apresentações originais

ESTRUTURA OBRIGATÓRIA — siga exatamente esta ordem:

# Relatório de Gestão — ${reportPeriod}
## Fontes: ${docNames}

## 1. Mudanças Táticas nos Portfólios
(Todas as mudanças com: ativo vendido, ativo comprado, tamanho em pp, data exata, racional completo da gestão)

## 2. Composição dos Portfólios Modelo
### 2.1 Alocação entre Classes de Ativos
(Tabela completa: Liquidity / Bond / Conservative / Income / Balanced / Growth com % por classe e limites de risco)

### 2.2 AMC Equities — Composição Detalhada
(Tabela com todos os tickers, nomes, % por portfólio)

### 2.3 AMC Fixed Income — Composição Detalhada
(Tabela com todos os tickers, nomes, share class, % de alocação)

### 2.4 AMC Alternatives — Composição Detalhada
(Tabela com nome do fundo, estratégia, liquidez, risco 1-7, fees)

## 3. Performance e Attribution
(Performance por portfólio no mês e YTD, top/bottom contribuidores se disponível)

## 4. Macro & Mercados
### 4.1 Economia Americana (atividade, emprego, inflação)
### 4.2 Política Monetária — Fed (expectativas de cortes, comunicação)
### 4.3 Renda Fixa (curva Treasuries, spreads IG/HY, estratégia de duration)
### 4.4 Renda Variável (performance setorial, big techs, global vs EUA)
### 4.5 Moedas (USD, principais movimentos)

## 5. BofA Global Fund Manager Survey
(Principais insights do sentimento institucional global)

## 6. Decisões do Comitê de Investimentos
(Todas as decisões tomadas, temas discutidos, próximos passos)

## 7. Perguntas e Respostas para Advisors
(Gere 20 perguntas específicas ao conteúdo deste relatório, com resposta curta para cada uma. Formato: **P:** pergunta **R:** resposta)`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Conteúdo das apresentações para o período ${reportPeriod}:\n\n${context}`
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error("Claude API error: " + err);
    }

    const claudeData = await claudeRes.json();
    const reportMarkdown = claudeData.content?.[0]?.text || "";

    if (!reportMarkdown || reportMarkdown.length < 100) {
      throw new Error("Claude returned empty report");
    }

    // Save report document
    const { data: reportDoc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        name: reportName,
        type: "relatorio",
        fund_name: "Galapagos Capital",
        period: reportPeriod,
        status: "processing",
        chunk_count: 0,
        owner_id: null,
      })
      .select()
      .single();

    if (insertErr || !reportDoc) {
      throw new Error("Failed to insert report document: " + insertErr?.message);
    }

    // Chunk the report for RAG
    const paragraphs = reportMarkdown.split(/\n\n+/);
    const maxChunkChars = 2000;
    const reportChunks: string[] = [];
    let current = "";

    for (const para of paragraphs) {
      if (current.length + para.length > maxChunkChars && current.length > 0) {
        reportChunks.push(current.trim());
        current = para;
      } else {
        current += (current ? "\n\n" : "") + para;
      }
    }
    if (current.trim().length > 50) reportChunks.push(current.trim());

    // Generate embeddings and store chunks
    const embeddedChunks: { chunk: string; embedding: number[]; index: number }[] = [];

    for (let i = 0; i < reportChunks.length; i++) {
      const embRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text: reportChunks[i] }] },
            outputDimensionality: 768,
          }),
        }
      );
      if (!embRes.ok) continue;
      const embData = await embRes.json();
      embeddedChunks.push({
        chunk: reportChunks[i],
        embedding: embData.embedding.values,
        index: i,
      });
      // Small delay to avoid rate limiting
      if (i > 0 && i % 5 === 0) await new Promise(r => setTimeout(r, 200));
    }

    // Store chunks in batches
    const chunkRecords = embeddedChunks.map(({ chunk, embedding, index }) => ({
      document_id: reportDoc.id,
      content: chunk,
      embedding: `[${embedding.join(",")}]`,
      chunk_index: index,
      metadata: {
        fund_name: "Galapagos Capital",
        period: reportPeriod,
        document_type: "relatorio",
        document_name: reportName,
        source_document_ids: document_ids,
        is_monthly_report: true,
      },
    }));

    for (let i = 0; i < chunkRecords.length; i += 50) {
      await supabase.from("document_chunks").insert(chunkRecords.slice(i, i + 50));
    }

    // Mark as indexed
    await supabase.from("documents").update({
      status: "indexed",
      chunk_count: chunkRecords.length,
    }).eq("id", reportDoc.id);

    console.log(`Report generated: ${reportName} — ${chunkRecords.length} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: reportDoc.id,
        period: reportPeriod,
        name: reportName,
        chunk_count: chunkRecords.length,
        preview: reportMarkdown.slice(0, 500),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
