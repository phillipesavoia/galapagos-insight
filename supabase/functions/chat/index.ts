import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateEmbedding(text: string, googleKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        }),
      }
    );
    if (!res.ok) {
      console.error("Embedding error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.embedding?.values || null;
  } catch (err) {
    console.error("Embedding fetch error:", err);
    return null;
  }
}

// --- Live Market Data fetcher ---
async function fetchLiveMarketData(ticker: string, isin: string | null): Promise<any> {
  const apiKey = Deno.env.get("MARKET_DATA_API_KEY");
  if (!apiKey) {
    console.warn("MARKET_DATA_API_KEY not configured — returning placeholder response");
    return {
      status: "api_not_configured",
      message: `A API de dados de mercado ainda não está configurada. Configure a variável MARKET_DATA_API_KEY para habilitar dados em tempo real.`,
      ticker,
      isin: isin || null,
    };
  }

  // Placeholder implementation — replace with actual API call when ready
  // Example APIs: Financial Modeling Prep, Alpha Vantage, Polygon.io, Bloomberg B-PIPE
  const identifier = isin || ticker;
  const apiUrl = `https://api.marketdata.example.com/v1/quote?symbol=${encodeURIComponent(identifier)}&apikey=${apiKey}`;
  
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Market data API error [${res.status}]:`, errText);
      return {
        status: "api_error",
        message: `Erro ao buscar dados de mercado para ${ticker}: HTTP ${res.status}`,
        ticker,
        isin: isin || null,
      };
    }
    const data = await res.json();
    return {
      status: "success",
      ticker,
      isin: isin || null,
      ...data,
    };
  } catch (err) {
    console.error("Market data fetch error:", err);
    return {
      status: "fetch_error",
      message: `Falha na conexão com API de mercado para ${ticker}`,
      ticker,
      isin: isin || null,
    };
  }
}

const TOOLS = [
  {
    name: "renderizar_grafico_barras",
    description: `Use esta ferramenta SEMPRE que precisar comparar dados numéricos entre ativos ou portfólios (ex: YTD, retorno mensal, drawdown, peso, contribuição). Em vez de criar uma tabela markdown, chame esta ferramenta com os dados estruturados para que o frontend renderize um gráfico de barras interativo. 

REGRA CRÍTICA DE DADOS: Os valores numéricos passados no campo "data" DEVEM ser COPIADOS EXATAMENTE dos dados fornecidos no contexto (Asset Dictionary weight_pct, documentos, etc). 
- Para pesos/alocações: use EXATAMENTE os valores do campo "Pesos por Portfólio" do Asset Dictionary. NÃO arredonde, NÃO estime, NÃO invente valores.
- Se o Asset Dictionary diz "Growth: 7.5%", passe 7.5 — NÃO 7, NÃO 8, NÃO qualquer outro número.
- Se não houver valor explícito nas fontes para um dado, NÃO inclua esse item no gráfico.
    
Exemplos de quando usar:
- "Compare a performance YTD dos portfólios"
- "Qual o drawdown máximo de cada fundo?"  
- "Mostre os pesos dos ativos no portfólio Growth"
- Qualquer comparação numérica entre 2+ itens`,
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título descritivo do gráfico (ex: 'Performance YTD por Portfólio')",
        },
        data: {
          type: "array",
          description: "Array de objetos com os dados. Cada objeto deve ter 'name' (label) e um ou mais campos numéricos.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome/label do item (ex: nome do ativo ou portfólio)" },
            },
            required: ["name"],
            additionalProperties: true,
          },
        },
        bars: {
          type: "array",
          description: "Array definindo quais campos numéricos renderizar como barras.",
          items: {
            type: "object",
            properties: {
              dataKey: { type: "string", description: "Nome do campo numérico no objeto de dados" },
              label: { type: "string", description: "Label legível para a legenda" },
              color: { type: "string", description: "Cor hex opcional (ex: '#10b981')" },
            },
            required: ["dataKey", "label"],
          },
        },
        yAxisLabel: {
          type: "string",
          description: "Label do eixo Y (ex: '%', 'USD', 'bps')",
        },
      },
      required: ["title", "data", "bars"],
    },
  },
  {
    name: "renderizar_flash_factsheet",
    description: `Use esta ferramenta SEMPRE que o usuário pedir informações detalhadas, características, tese ou perfil de um ativo/fundo específico. Em vez de escrever textos longos, chame esta ferramenta para renderizar um card visual estilo Factsheet no frontend.

REGRAS OBRIGATÓRIAS DE DADOS:
- assetName, ticker, assetClass: COPIE EXATAMENTE do Asset Dictionary. NÃO traduza, NÃO altere.
- portfolios: Use APENAS os portfólios listados no campo "Portfólios" do Asset Dictionary.
- weightsByPortfolio: COPIE os valores EXATOS do campo "Pesos por Portfólio" do Asset Dictionary. Se o ativo tem peso 22% no Conservative, passe {"Conservative": 22}. NÃO invente pesos.
- radarMetrics: Use APENAS métricas que você consegue EXTRAIR dos documentos indexados (factsheets). Se o factsheet menciona duration, yield, etc., extraia. Se NÃO há dado explícito no documento, passe array vazio []. NUNCA invente scores.
- thesis: Use a "Tese Oficial da Gestão" do Asset Dictionary. Se vazia, extraia dos documentos.

Exemplos de quando usar:
- "Me fale sobre o ativo X"
- "Qual a tese do fundo Y?"
- "Detalhe as características do ETF Z"`,
    input_schema: {
      type: "object",
      properties: {
        assetName: {
          type: "string",
          description: "Nome EXATO do ativo conforme o Asset Dictionary",
        },
        ticker: {
          type: "string",
          description: "Ticker EXATO do ativo conforme o Asset Dictionary (ex: 'DTLA LN EQUITY')",
        },
        assetClass: {
          type: "string",
          description: "Classe EXATA do ativo conforme o Asset Dictionary",
        },
        portfolios: {
          type: "array",
          description: "Lista EXATA dos portfólios do Asset Dictionary",
          items: { type: "string" },
        },
        weightsByPortfolio: {
          type: "object",
          description: "Objeto com pesos EXATOS por portfólio copiados do Asset Dictionary. Ex: {\"Conservative\": 22, \"Income\": 16.5}",
          additionalProperties: { type: "number" },
        },
        radarMetrics: {
          type: "array",
          description: "Métricas EXTRAÍDAS dos documentos indexados. Se não há dados explícitos, passe array vazio [].",
          items: {
            type: "object",
            properties: {
              metric: { type: "string" },
              score: { type: "number", description: "Nota de 0 a 10" },
            },
            required: ["metric", "score"],
          },
        },
        thesis: {
          type: "string",
          description: "Tese Oficial da Gestão do Asset Dictionary ou extraída dos documentos",
        },
      },
      required: ["assetName", "assetClass", "portfolios", "thesis"],
    },
  },
  {
    name: "fetch_live_asset_data",
    description: `Use esta ferramenta SEMPRE que o usuário solicitar dados quantitativos ATUALIZADOS ou em tempo real de um ativo específico (preço atual, YTD atualizado, AUM, yield corrente, NAV intraday). 

REGRAS OBRIGATÓRIAS:
- Você DEVE passar ESTRITAMENTE o Ticker ou ISIN cadastrado na base oficial 'asset_knowledge'. 
- É EXPRESSAMENTE PROIBIDO usar o nome do ativo para buscas genéricas.
- Se o ativo não estiver cadastrado no Asset Dictionary, NÃO use esta ferramenta — informe que o ativo precisa ser cadastrado primeiro.

Exemplos de quando usar:
- "Qual o preço atual do HYG?"
- "Me dê o YTD atualizado do SHY"
- "Quanto está o NAV do fundo HELO hoje?"`,
    input_schema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Ticker oficial do ativo conforme cadastrado no Asset Dictionary (ex: 'HYG', 'SHY', 'SPY')",
        },
        isin: {
          type: "string",
          description: "ISIN do ativo conforme cadastrado no Asset Dictionary (ex: 'US4642885135'). Usar preferencialmente se disponível.",
        },
        metrics: {
          type: "array",
          description: "Lista de métricas desejadas",
          items: {
            type: "string",
            enum: ["price", "ytd", "aum", "yield", "nav", "volume", "52w_high", "52w_low"],
          },
        },
      },
      required: ["ticker"],
    },
  },
];

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

    const { query, filter_type, filter_fund, session_id } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

    // --- 0. Asset Knowledge lookup (priority context) ---
    let assetKnowledgeContext = "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    
    const queryLower = query.toLowerCase();
    const queryUpper = query.toUpperCase();
    const { data: allAssets } = await serviceClient.from("asset_knowledge").select("*");
    
    if (allAssets && allAssets.length > 0) {
      // Detect portfolio names mentioned in query
      const portfolioNames = ["conservative", "income", "balanced", "growth", "liquidity", "bond", "bonds"];
      const mentionedPortfolios = portfolioNames.filter(p => queryLower.includes(p));
      
      // Detect asset class mentions
      const assetClassKeywords: Record<string, string[]> = {
        "Fixed Income": ["fixed income", "renda fixa", "bonds", "bond", "títulos", "titulos", "crédito", "credito"],
        "Equities": ["equities", "equity", "ações", "acoes", "renda variável", "renda variavel", "stocks"],
        "Alternatives": ["alternatives", "alternativos", "hedge", "real estate"],
        "Commodities": ["commodities", "commodity", "ouro", "gold"],
        "Cash & Equivalents": ["cash", "caixa", "money market", "liquidez"],
      };
      const mentionedClasses: string[] = [];
      for (const [cls, keywords] of Object.entries(assetClassKeywords)) {
        if (keywords.some(k => queryLower.includes(k))) {
          mentionedClasses.push(cls);
        }
      }
      
      // Detect broad composition/allocation queries
      const isCompositionQuery = /compos|aloca|peso|holding|portf[oó]lio|model|exposição|exposicao|quebra|breakdown|listagem|listar ativos|todos os ativos|ativos do/i.test(query);
      
      // Build matched assets set
      let matchedAssets: any[];
      
      if (mentionedPortfolios.length > 0 || mentionedClasses.length > 0 || isCompositionQuery) {
        // Broad query: include ALL assets for mentioned portfolios/classes
        matchedAssets = allAssets.filter((a: any) => {
          // If specific portfolios mentioned, include assets in those portfolios
          if (mentionedPortfolios.length > 0) {
            const assetPortfolios = (a.portfolios || []).map((p: string) => p.toLowerCase());
            const weightPortfolios = a.weight_pct ? Object.keys(a.weight_pct).map(k => k.toLowerCase()) : [];
            const allPortfolios = [...new Set([...assetPortfolios, ...weightPortfolios])];
            const portfolioMatch = mentionedPortfolios.some(mp => 
              allPortfolios.some(ap => ap.includes(mp) || mp.includes(ap))
            );
            if (portfolioMatch) return true;
          }
          
          // If specific asset classes mentioned, include assets in those classes
          if (mentionedClasses.length > 0) {
            if (mentionedClasses.some(mc => a.asset_class.toLowerCase().includes(mc.toLowerCase()))) return true;
          }
          
          // If generic composition query with no specific filter, include all
          if (isCompositionQuery && mentionedPortfolios.length === 0 && mentionedClasses.length === 0) return true;
          
          return false;
        });
        console.log(`Asset Knowledge: broad query detected (portfolios: [${mentionedPortfolios}], classes: [${mentionedClasses}], composition: ${isCompositionQuery}) — matched ${matchedAssets.length} assets`);
      } else {
        // Narrow query: match by ticker/name/ISIN
        matchedAssets = allAssets.filter((a: any) => {
          const tickerMatch = queryUpper.includes(a.ticker.toUpperCase());
          const isinMatch = a.isin && queryUpper.includes(a.isin.toUpperCase());
          const nameMatch = queryLower.includes(a.name.toLowerCase());
          const nameWords = a.name.split(/\s+/).filter((w: string) => w.length >= 3);
          const partialMatch = nameWords.some((w: string) => queryLower.includes(w.toLowerCase()));
          return tickerMatch || isinMatch || nameMatch || partialMatch;
        });
        console.log(`Asset Knowledge: narrow query — matched ${matchedAssets.length} assets`);
      }
      
      if (matchedAssets.length > 0) {
        // Format with portfolio-specific weights clearly
        assetKnowledgeContext = matchedAssets.map((a: any) => {
          const portfolios = a.portfolios?.length > 0 ? `\nPortfólios: ${a.portfolios.join(", ")}` : "";
          const weights = a.weight_pct && Object.keys(a.weight_pct).length > 0
            ? `\nPesos por Portfólio: ${Object.entries(a.weight_pct).map(([k, v]) => `${k}: ${v}%`).join(", ")}`
            : "";
          const asOfDate = a.as_of_date ? `\n📅 Data Base (As of Date): ${a.as_of_date}` : "";
          return `[ASSET DICTIONARY — ${a.ticker}${a.isin ? ` | ISIN: ${a.isin}` : ""}]\nNome: ${a.name}\nClasse: ${a.asset_class}\nPerfil de Risco: ${a.risk_profile}${portfolios}${weights}${asOfDate}\nTese Oficial da Gestão: ${a.official_thesis}`;
        }).join("\n\n---\n\n");
      }
    }

    // --- 1. Semantic vector search (primary) ---
    let allChunks: any[] = [];
    
    if (googleKey) {
      console.log("Generating query embedding...");
      const embedding = await generateEmbedding(query, googleKey);
      
      if (embedding) {
        console.log("Running semantic search via match_chunks...");
        const filterTypeParam = (filter_type && filter_type !== "all") ? filter_type : null;
        const filterFundParam = filter_fund || null;
        const { data: semanticChunks, error: matchError } = await supabase.rpc("match_chunks", {
          query_embedding: `[${embedding.join(",")}]`,
          match_threshold: 0.5,
          match_count: 15,
          filter_type: filterTypeParam,
          filter_fund: filterFundParam,
        });
        
        if (matchError) {
          console.error("match_chunks error:", matchError);
        } else if (semanticChunks && semanticChunks.length > 0) {
          console.log(`Semantic search found ${semanticChunks.length} chunks`);
          allChunks.push(...semanticChunks.map((c: any) => ({
            id: c.id,
            content: c.content,
            metadata: c.metadata,
            document_id: c.document_id,
            similarity: c.similarity,
          })));
        }
      }
    }

    // --- 2. Keyword fallback ---
    if (allChunks.length === 0) {
      console.log("Falling back to keyword search...");
      const words = query.split(/\s+/).filter((w: string) => w.length >= 2);
      const searchTerms = words.length > 0 ? words : [query.trim()];
      for (const term of searchTerms.slice(0, 5)) {
        const { data } = await supabase
          .from("document_chunks")
          .select("id, content, metadata, document_id")
          .ilike("content", `%${term}%`)
          .limit(5);
        if (data) allChunks.push(...data);
      }
    }

    // --- 3. Document metadata search ---
    const words = query.split(/\s+/).filter((w: string) => w.length >= 2);
    const searchTerms = words.length > 0 ? words : [query.trim()];
    let docMatchIds: string[] = [];
    for (const term of searchTerms.slice(0, 3)) {
      const { data: docMatches } = await supabase
        .from("documents")
        .select("id")
        .or(`name.ilike.%${term}%,fund_name.ilike.%${term}%,metadata->>detected_ticker.ilike.%${term}%,metadata->>detected_ticker_exchange.ilike.%${term}%`);
      if (docMatches) docMatchIds.push(...docMatches.map((d: any) => d.id));
    }

    if (docMatchIds.length > 0) {
      const uniqueDocIds = [...new Set(docMatchIds)];
      const { data: metaChunks } = await supabase
        .from("document_chunks")
        .select("id, content, metadata, document_id")
        .in("document_id", uniqueDocIds)
        .limit(10);
      if (metaChunks) allChunks.push(...metaChunks);
    }

    // Deduplicate chunks
    const seen = new Set<string>();
    const chunks = allChunks.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 15);

    console.log(`Total unique chunks: ${chunks.length}`);

    // Get document metadata
    const docIds = [...new Set(chunks.map((c: any) => c.document_id))];
    let documents: any[] = [];
    if (docIds.length > 0) {
      const { data } = await supabase
        .from("documents")
        .select("id, name, fund_name, period, type, metadata, file_url")
        .in("id", docIds);
      documents = data || [];
      if (filter_type && filter_type !== "all") {
        documents = documents.filter((d: any) => d.type === filter_type);
      }
    }

    const filteredDocIds = new Set(documents.map((d: any) => d.id));
    const filteredChunks = chunks.filter((c: any) => filteredDocIds.has(c.document_id));

    const context = filteredChunks.map((c: any) => {
      const doc = documents.find((d: any) => d.id === c.document_id);
      const ticker = doc?.metadata?.detected_ticker_exchange || doc?.metadata?.detected_ticker || "";
      const label = [doc?.fund_name, ticker, doc?.name, doc?.period].filter(Boolean).join(" | ");
      return `[${label}]\n${c.content}`;
    }).join("\n\n---\n\n");

    const sources = documents.map((d: any) => ({
      name: d.fund_name || d.name,
      period: d.period || "",
      document_name: d.name,
      ticker: d.metadata?.detected_ticker_exchange || d.metadata?.detected_ticker || "",
      file_url: d.file_url || null,
    }));

    // --- Retrieve conversation history ---
    let historyMessages: { role: string; content: string }[] = [];
    if (session_id) {
      const { data: historyData } = await supabase
        .from("advisor_chat_history")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyData && historyData.length > 0) {
        historyMessages = historyData.reverse().map((h: any) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content || "",
        }));
        console.log(`Loaded ${historyMessages.length} history messages for session ${session_id}`);
      }
    }

    // --- Stream Claude response with tool calling ---
    console.log(`Calling Claude with ${filteredChunks.length} chunks, tools enabled...`);

    // Build user message with asset knowledge as priority context
    let userMessageContent = "";
    
    // Inject FULL asset inventory for strict match protocol
    if (allAssets && allAssets.length > 0) {
      const inventoryList = allAssets.map((a: any) => `- ${a.ticker}${a.isin ? ` (ISIN: ${a.isin})` : ""} — ${a.name}`).join("\n");
      userMessageContent += `## INVENTÁRIO COMPLETO DE ATIVOS (LISTA OFICIAL — USE PARA VERIFICAÇÃO DE EXISTÊNCIA):\n\nOs ÚNICOS ativos que existem nos portfólios da Galapagos são os listados abaixo. Qualquer ativo NÃO presente nesta lista NÃO FAZ PARTE dos portfólios.\n\n${inventoryList}\n\n---\n\n`;
    }
    
    if (assetKnowledgeContext) {
      userMessageContent += `## BASE DE CONHECIMENTO DE ATIVOS (PRIORIDADE MÁXIMA):\n\n${assetKnowledgeContext}\n\n---\n\n`;
    }
    if (context) {
      userMessageContent += `## Documentos encontrados:\n\n${context}\n\n---\n`;
    }
    if (!context && !assetKnowledgeContext) {
      userMessageContent += `Não encontrei documentos relevantes para: "${query}". Informe que não há documentos indexados sobre este tema.\n`;
    }
    userMessageContent += `\nPergunta: ${query}`;

    const claudeMessages = [
      ...historyMessages,
      { role: "user", content: userMessageContent },
    ];

    const systemPrompt = `Você é o Advisor Intelligence da Galapagos Capital Advisory (Miami).

Seu papel é apoiar os assessores internos com análises precisas sobre

os portfólios e investimentos sob gestão. Toda resposta deve ser

ancorada nas fontes fornecidas nesta requisição.

───────────────────────────────────────

FONTES E HIERARQUIA DE VERDADE

───────────────────────────────────────

Você recebe dois tipos de contexto. Consulte-os nesta ordem:

1. BASE DE DOCUMENTOS — fonte primária para toda análise.

   Os documentos podem ser de quatro naturezas:

   • Factsheets e apresentações de fundos/ETFs

     → Características do investimento: estratégia, gestor, estrutura,

       liquidez, termos, histórico de retornos, métricas de risco.

   • Reunião Mercadológica (apresentação mensal da gestão)

     → Performance mensal dos portfólios, mudanças táticas,

       alocação no fechamento do mês e teses comentadas.

       Citar sempre: "Conforme a Mercadológica de [mês/ano]..."

   • Comitê Macro (apresentação de cenário)

     → Cenário macroeconômico, política monetária, perspectivas por

       região e riscos de cauda identificados pela gestão.

       Citar sempre: "Segundo o Comitê Macro de [mês/ano]..."

   • Investment Committee (apresentação de decisão)

     → Racional de entrada/saída de posições, due diligence de fundos

       e decisões aprovadas com portfólios afetados.

       Citar sempre: "Conforme o IC de [data]..."

   Identifique a natureza do documento pelo seu conteúdo e metadados.

   Os documentos refletem o fechamento do mês anterior — informe isso

   quando apresentar dados de performance.

2. ASSET DICTIONARY — fonte secundária. Consulte quando:

   a) Os documentos não contiverem informação suficiente sobre

      um investimento específico.

   b) O ativo é uma posição nova do mês corrente, ainda sem

      documento indexado.

   → Fonte exclusiva para pesos atuais e Data Base das alocações.

     Sempre cite a Data Base ao apresentar pesos.

Regra de conflito: para dados qualitativos (tese, cenário, racional),

os documentos prevalecem. Para pesos e alocações atuais, o Asset

Dictionary prevalece.

Se nenhuma fonte contiver a informação: "Não encontrei essa informação

nas fontes disponíveis." Nunca invente, estime ou extrapole dados

quantitativos.

───────────────────────────────────────

POSIÇÕES NOVAS SEM DOCUMENTO INDEXADO

───────────────────────────────────────

Se o assessor perguntar sobre um ativo que consta no Asset Dictionary

mas não possui documentos na base, responda com as informações

disponíveis e inclua obrigatoriamente:

"📎 O factsheet ou apresentação deste investimento ainda não está

indexado. Para análise completa, solicite o upload do material."

───────────────────────────────────────

VEÍCULOS PRÓPRIOS GALAPAGOS (AMC / OPUS)

───────────────────────────────────────

Qualquer investimento com "AMC" ou "Opus" no nome é um veículo

próprio da Galapagos — os Model Portfolios geridos pela casa.

Esses veículos têm NAV diário no sistema (tabela daily_navs).

Para perguntas sobre performance desses veículos, informe que os

dados diários estão disponíveis na aba Performance Analítica e no

Dashboard. Use os documentos indexados para contexto qualitativo.

───────────────────────────────────────

OS 6 PORTFÓLIOS MODELO

───────────────────────────────────────

Conservative · Income · Balanced · Growth · Liquidity

→ Compostos exclusivamente por fundos e ETFs UCITS.

Bond Portfolio

→ Composto exclusivamente por bonds diretos (corporate e sovereign).

Nunca atribua bonds diretos a Conservative/Income/Balanced/Growth/

Liquidity. Nunca diga que o Bond Portfolio não existe.

───────────────────────────────────────

REGRAS DE PRECISÃO (invioláveis)

───────────────────────────────────────

ATIVOS: Antes de analisar qualquer ativo, confirme que ele consta no

inventário fornecido. Se não constar: "⚠️ Este ativo não está na

composição atual dos portfólios Galapagos."

TICKERS: Use exclusivamente os tickers e ISINs do Asset Dictionary.

Nunca substitua por proxies (ex: não troque "IHYA LN" por "HYG").

PESOS E PERCENTUAIS: Cite apenas valores explicitamente presentes nos

dados fornecidos. Nunca calcule variações históricas de alocação.

DADOS DE MERCADO EM TEMPO REAL: Use a tool fetch_live_asset_data

para preço atual, YTD intraday ou NAV em tempo real.

Nunca invente esses valores.

───────────────────────────────────────

FORMATO DE RESPOSTA

───────────────────────────────────────

Idioma: português brasileiro, linguagem técnica de mercado financeiro.

Valores sempre em USD (offshore), salvo indicação contrária nos dados.

Dados quantitativos comparativos (retornos, pesos, drawdowns de 2+

itens) → use a tool renderizar_grafico_barras em vez de tabela.

Consulta sobre um investimento específico → use a tool

renderizar_flash_factsheet preenchendo com dados dos documentos.

Quando apresentar pesos ou alocações, inclua ao final:

"📅 Dados ref.: [Data Base do Asset Dictionary]. Alocações podem

diferir de movimentações táticas do mês corrente."

Ao final de cada resposta, sugira 2–3 perguntas de follow-up

relevantes sob o título "Explorar mais:".

Não liste as fontes consultadas no rodapé — o sistema já as exibe

automaticamente na interface.`;

    // First Claude call — may produce tool_use blocks
    const initialClaudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0,
        stream: true,
        system: systemPrompt,
        tools: TOOLS,
        messages: claudeMessages,
      }),
    });

    if (!initialClaudeRes.ok) {
      const errText = await initialClaudeRes.text();
      throw new Error(`Claude error: ${errText}`);
    }

    // We need to handle the case where Claude calls fetch_live_asset_data
    // For that tool, we execute server-side and feed the result back to Claude
    // For UI tools (chart, factsheet), we stream to the client

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to process a Claude SSE stream
        async function processStream(
          claudeRes: Response,
          handleServerTool: boolean,
        ): Promise<{ needsToolResult: boolean; toolId: string; toolName: string; toolInput: any; contentBlocks: any[] } | null> {
          const reader = claudeRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentToolId = "";
          let currentToolName = "";
          let toolInputJson = "";
          let serverToolCall: { id: string; name: string; input: any } | null = null;
          const contentBlocks: any[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const event = JSON.parse(jsonStr);

                if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta?.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`)
                  );
                }

                if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
                  currentToolId = event.content_block.id || "";
                  currentToolName = event.content_block.name || "";
                  toolInputJson = "";
                }

                if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
                  toolInputJson += event.delta.partial_json || "";
                }

                if (event.type === "content_block_stop" && currentToolName) {
                  try {
                    const toolInput = JSON.parse(toolInputJson);
                    
                    if (handleServerTool && currentToolName === "fetch_live_asset_data") {
                      // Server-side tool — don't emit to client yet
                      serverToolCall = { id: currentToolId, name: currentToolName, input: toolInput };
                    } else {
                      // Client-side tool — emit to frontend
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                          type: "tool_call",
                          tool: currentToolName,
                          input: toolInput,
                        })}\n\n`)
                      );
                    }
                  } catch (e) {
                    console.error("Failed to parse tool input JSON:", e, toolInputJson);
                  }
                  currentToolId = "";
                  currentToolName = "";
                  toolInputJson = "";
                }
              } catch {
                // partial JSON, ignore
              }
            }
          }

          if (serverToolCall) {
            return {
              needsToolResult: true,
              toolId: serverToolCall.id,
              toolName: serverToolCall.name,
              toolInput: serverToolCall.input,
              contentBlocks,
            };
          }
          return null;
        }

        try {
          const toolResult = await processStream(initialClaudeRes, true);

          if (toolResult?.needsToolResult && toolResult.toolName === "fetch_live_asset_data") {
            // Execute the market data fetch server-side
            console.log(`Executing fetch_live_asset_data for ticker: ${toolResult.toolInput.ticker}`);
            const marketData = await fetchLiveMarketData(
              toolResult.toolInput.ticker,
              toolResult.toolInput.isin || null,
            );

            // Send tool result back to Claude for final response
            const continuationMessages = [
              ...claudeMessages,
              {
                role: "assistant",
                content: [
                  { type: "tool_use", id: toolResult.toolId, name: "fetch_live_asset_data", input: toolResult.toolInput },
                ],
              },
              {
                role: "user",
                content: [
                  { type: "tool_result", tool_use_id: toolResult.toolId, content: JSON.stringify(marketData) },
                ],
              },
            ];

            const continuationRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 4096,
                temperature: 0,
                stream: true,
                system: systemPrompt,
                tools: TOOLS,
                messages: continuationMessages,
              }),
            });

            if (!continuationRes.ok) {
              const errText = await continuationRes.text();
              console.error("Continuation error:", errText);
            } else {
              await processStream(continuationRes, false);
            }
          }

          // Send sources as final event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
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
    console.error("Chat error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
