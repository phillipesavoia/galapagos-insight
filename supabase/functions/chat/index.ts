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

// --- Live Market Data fetcher (cascading providers) ---
interface MarketDataResult {
  status: "success" | "error" | "not_found";
  ticker: string;
  isin: string | null;
  price?: number;
  currency?: string;
  change?: number;
  changePercent?: number;
  ytdReturn?: number;
  volume?: number;
  marketCap?: number;
  yield?: number;
  nav?: number;
  aum?: number;
  name?: string;
  asOf?: string;
  provider?: string;
  message?: string;
}

async function fetchLiveMarketData(ticker: string, isin: string | null): Promise<MarketDataResult> {
  const base: MarketDataResult = { status: "not_found", ticker, isin };

  // --- 1. Financial Modeling Prep ---
  const fmpKey = Deno.env.get("FMP_API_KEY");
  if (fmpKey) {
    try {
      const symbol = ticker.split(" ")[0];
      const res = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(symbol)}?apikey=${fmpKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const q = Array.isArray(data) ? data[0] : data;
        if (q?.price) {
          return {
            status: "success", ticker, isin,
            price: q.price,
            currency: "USD",
            change: q.change,
            changePercent: q.changesPercentage,
            volume: q.volume,
            marketCap: q.marketCap,
            yield: q.dividendYield,
            name: q.name,
            asOf: new Date().toISOString().slice(0, 10),
            provider: "FMP",
          };
        }
      }
    } catch (e) {
      console.warn("FMP failed:", e);
    }
  }

  // --- 2. Polygon.io ---
  const polygonKey = Deno.env.get("POLYGON_API_KEY");
  if (polygonKey) {
    try {
      const symbol = ticker.split(" ")[0];
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${polygonKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const r = data?.results?.[0];
        if (r?.c) {
          return {
            status: "success", ticker, isin,
            price: r.c,
            currency: "USD",
            change: r.c - r.o,
            changePercent: ((r.c - r.o) / r.o) * 100,
            volume: r.v,
            asOf: new Date(r.t).toISOString().slice(0, 10),
            provider: "Polygon",
          };
        }
      }
    } catch (e) {
      console.warn("Polygon failed:", e);
    }
  }

  // --- 3. Alpha Vantage ---
  const avKey = Deno.env.get("ALPHA_VANTAGE_KEY");
  if (avKey) {
    try {
      const symbol = ticker.split(" ")[0];
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${avKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const q = data?.["Global Quote"];
        if (q?.["05. price"]) {
          return {
            status: "success", ticker, isin,
            price: parseFloat(q["05. price"]),
            currency: "USD",
            change: parseFloat(q["09. change"]),
            changePercent: parseFloat(q["10. change percent"]?.replace("%", "")),
            volume: parseInt(q["06. volume"]),
            asOf: q["07. latest trading day"],
            provider: "AlphaVantage",
          };
        }
      }
    } catch (e) {
      console.warn("AlphaVantage failed:", e);
    }
  }

  // --- 4. Yahoo Finance (no key needed) ---
  try {
    const symbol = ticker.split(" ")[0];
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        return {
          status: "success", ticker, isin,
          price: meta.regularMarketPrice,
          currency: meta.currency,
          change: meta.regularMarketPrice - meta.previousClose,
          changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
          volume: meta.regularMarketVolume,
          marketCap: meta.marketCap,
          name: meta.longName || meta.shortName,
          asOf: new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10),
          provider: "Yahoo",
        };
      }
    }
  } catch (e) {
    console.warn("Yahoo Finance failed:", e);
  }

  // --- All providers failed ---
  return {
    ...base,
    status: "error",
    message: `Nenhum provider retornou dados para ${ticker}. Verifique se o ticker está correto (ex: AAPL, SPY, DTLA LN).`,
  };
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
  {
    name: "renderizar_tabela_retornos",
    description: "Renderiza uma tabela formatada de retornos mensais e anuais. Use quando o usuário pedir histórico de retornos, performance mensal, tabela de resultados ou comparativo de períodos.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título da tabela" },
        rows: {
          type: "array",
          description: "Array de linhas. Cada linha tem 'label' e campos numéricos para cada período.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        columns: {
          type: "array",
          description: "Colunas da tabela (ex: ['Jan', 'Fev', 'Mar', ..., 'Ano'])",
          items: { type: "string" },
        },
        colorize: { type: "boolean", description: "Se true, colore positivo em verde e negativo em vermelho" },
      },
      required: ["title", "rows", "columns"],
    },
  },
  {
    name: "renderizar_grafico_linha",
    description: "Renderiza um gráfico de linha para evolução temporal. Use para mostrar NAV acumulado, performance ao longo do tempo, ou comparação de múltiplas séries históricas.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        data: {
          type: "array",
          description: "Array de pontos com 'date' (YYYY-MM-DD) e campos numéricos para cada série",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
            },
            additionalProperties: true,
          },
        },
        lines: {
          type: "array",
          description: "Definição das linhas do gráfico",
          items: {
            type: "object",
            properties: {
              dataKey: { type: "string" },
              label: { type: "string" },
              color: { type: "string" },
            },
            required: ["dataKey", "label"],
          },
        },
        yAxisLabel: { type: "string" },
      },
      required: ["title", "data", "lines"],
    },
  },
  {
    name: "renderizar_pie_chart",
    description: "Renderiza um pie chart ou donut chart de composição. Use para mostrar alocação por classe de ativo, distribuição por portfólio, ou breakdown de qualquer composição percentual.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        data: {
          type: "array",
          description: "Array de fatias com 'name' e 'value' (percentual)",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "number" },
              color: { type: "string", description: "Cor hex opcional" },
            },
            required: ["name", "value"],
          },
        },
        donut: { type: "boolean", description: "Se true, renderiza como donut chart" },
      },
      required: ["title", "data"],
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

    const { query, filter_type, filter_fund, session_id, free_search } = await req.json();
    const isFreeSearch = free_search === true;

    // Detect period intent from query
    // e.g. "dezembro 2025" → "2025-12", "março de 2026" → "2026-03", "atual" → most recent
    function detectPeriodFromQuery(q: string): string | null {
      const lower = q.toLowerCase();
      const monthMap: Record<string, string> = {
        "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03",
        "abril": "04", "maio": "05", "junho": "06", "julho": "07",
        "agosto": "08", "setembro": "09", "outubro": "10",
        "novembro": "11", "dezembro": "12",
        "jan": "01", "fev": "02", "mar": "03", "abr": "04",
        "mai": "05", "jun": "06", "jul": "07", "ago": "08",
        "set": "09", "out": "10", "nov": "11", "dez": "12",
      };
      for (const [monthName, monthNum] of Object.entries(monthMap)) {
        const regex = new RegExp(`${monthName}[^\\d]*(\\d{4})|${monthName}\\s*/\\s*(\\d{4})|(\\d{4})\\s*[/-]\\s*${monthName}`, "i");
        const match = lower.match(regex);
        if (match) {
          const year = match[1] || match[2] || match[3];
          if (year) return `${year}-${monthNum}`;
        }
      }
      // e.g. "2025-12" or "12/2025"
      const isoMatch = lower.match(/(\d{4})-(\d{2})/);
      if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
      const brMatch = lower.match(/(\d{2})\/(\d{4})/);
      if (brMatch) return `${brMatch[2]}-${brMatch[1]}`;
      return null;
    }

    const queriedPeriod = detectPeriodFromQuery(query);
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
    const { data: allAssets } = await serviceClient
      .from("asset_knowledge")
      .select("*")
      .order("name");

    if (allAssets && allAssets.length > 0) {
      const portfolioNames = ["conservative", "income", "balanced", "growth", "liquidity", "bond"];
      const mentionedPortfolios = portfolioNames.filter(p => queryLower.includes(p));
      const isLookThroughQuery = /amc|look.?through|abrir|detalh|completa|completo|quebr|todos os ativos|composicao|composição|alocacao|alocação|peso|holding|portf/i.test(query);

      let matchedAssets: any[];

      if (isLookThroughQuery || mentionedPortfolios.length > 0) {
        if (mentionedPortfolios.length > 0) {
          matchedAssets = allAssets.filter((a: any) => {
            const assetPortfolios = [...(a.portfolios || []), ...Object.keys(a.weight_pct || {})].map((p: string) => p.toLowerCase());
            return mentionedPortfolios.some(mp => assetPortfolios.some(ap => ap.includes(mp)));
          });
        } else {
          matchedAssets = allAssets;
        }
        console.log(`Asset Knowledge: look-through query — ${matchedAssets.length} assets`);
      } else {
        matchedAssets = allAssets.filter((a: any) => {
          const tickerMatch = queryUpper.includes(a.ticker?.toUpperCase() || "");
          const isinMatch = a.isin && queryUpper.includes(a.isin.toUpperCase());
          const nameMatch = a.name && queryLower.includes(a.name.toLowerCase());
          const nameWords = (a.name || "").split(/\s+/).filter((w: string) => w.length >= 4);
          const partialMatch = nameWords.some((w: string) => queryLower.includes(w.toLowerCase()));
          return tickerMatch || isinMatch || nameMatch || partialMatch;
        });
        console.log(`Asset Knowledge: narrow query — ${matchedAssets.length} assets`);
      }

      if (matchedAssets.length > 0) {
        const topLevel = matchedAssets.filter((a: any) => !a.amc_parent);
        const children = matchedAssets.filter((a: any) => a.amc_parent);

        const formatWeight = (a: any, portfolio?: string) => {
          if (!a.weight_pct || Object.keys(a.weight_pct).length === 0) return "";
          if (portfolio) {
            const w = a.weight_pct[portfolio];
            return w ? ` [${w}% no ${portfolio}]` : "";
          }
          return "\n  Pesos: " + Object.entries(a.weight_pct).map(([k, v]) => `${k}: ${v}%`).join(", ");
        };

        const sections: string[] = [];
        for (const asset of topLevel) {
          const isAMC = children.some((c: any) => c.amc_parent === asset.ticker);
          const header = `[${isAMC ? "AMC" : "ATIVO"} — ${asset.ticker}${asset.isin ? ` | ${asset.isin}` : ""}]`;
          const weights = formatWeight(asset);
          let section = `${header}\nNome: ${asset.name}\nClasse: ${asset.asset_class}${weights}\nTese: ${asset.official_thesis || "—"}`;

          if (isAMC) {
            const amcChildren = children
              .filter((c: any) => c.amc_parent === asset.ticker)
              .sort((x: any, y: any) => {
                const wx = Math.max(0, ...Object.values(x.weight_pct || {}).map(Number));
                const wy = Math.max(0, ...Object.values(y.weight_pct || {}).map(Number));
                return wy - wx;
              });

            section += `\n\n  === COMPOSIÇÃO INTERNA DO ${asset.name.toUpperCase()} (LOOK-THROUGH) ===`;
            for (const child of amcChildren) {
              const cWeights = formatWeight(child);
              section += `\n  ↳ [${child.ticker}] ${child.name} | ${child.asset_class}${cWeights}`;
            }
            section += `\n  === FIM DO LOOK-THROUGH ===`;
          }

          sections.push(section);
        }

        const topTickers = new Set(topLevel.map((a: any) => a.ticker));
        const orphans = children.filter((c: any) => !topTickers.has(c.amc_parent));
        for (const o of orphans) {
          sections.push(`[ATIVO (dentro de AMC) — ${o.ticker}]\nNome: ${o.name}\nClasse: ${o.asset_class}\nDentro do AMC: ${o.amc_parent}${formatWeight(o)}`);
        }

        assetKnowledgeContext = sections.join("\n\n---\n\n");
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

    // Fetch most recent report period for reference
    const { data: latestReport } = await serviceClient
      .from("documents")
      .select("period, name")
      .eq("type", "relatorio")
      .eq("status", "indexed")
      .order("period", { ascending: false })
      .limit(1);

    const latestReportPeriod = latestReport?.[0]?.period || null;
    const latestReportName = latestReport?.[0]?.name || null;

    const documentContext = context || "";
    const assetDictionaryContext = assetKnowledgeContext || "";

    const systemPrompt = `INSTRUÇÃO CRÍTICA: Cada mensagem do usuário deve ser respondida com base nos dados fornecidos NESTA requisição. Nunca reutilize dados de mensagens anteriores para responder perguntas sobre composição, pesos, ou alocações — sempre use os dados do Asset Dictionary fornecidos abaixo, que são frescos e completos para esta query.

Se o usuário pedir composição detalhada ou look-through:
1. Use EXCLUSIVAMENTE os dados do Asset Dictionary desta requisição
2. Liste TODOS os ativos encontrados, agrupados por AMC
3. Mostre os pesos de cada ativo no portfólio mencionado
4. Use renderizar_pie_chart para nível 1 (AMCs diretos)
5. Use renderizar_grafico_barras para os maiores holdings do look-through

${latestReportPeriod ? `
───────────────────────────────────────
RELATÓRIO MENSAL MAIS RECENTE: ${latestReportPeriod} — ${latestReportName}
Quando o advisor perguntar sobre gestão atual sem especificar período, use este como referência.
───────────────────────────────────────
` : ""}${assetDictionaryContext ? `
───────────────────────────────────────
ASSET DICTIONARY (pesos e alocações atuais)
───────────────────────────────────────
${assetDictionaryContext}
` : ""}${documentContext ? `
───────────────────────────────────────
BASE DE DOCUMENTOS INDEXADOS
───────────────────────────────────────
${documentContext}
` : ""}
Você é o Advisor Intelligence da Galapagos Capital Advisory — uma IA de investimentos de alta performance para uso interno dos assessores.

Você tem acesso a:
- Asset Dictionary com composição e pesos dos 6 portfólios modelo (Conservative, Income, Balanced, Growth, Liquidity, Bond Portfolio)
- Documentos indexados: factsheets, apresentações de fundos, reuniões mercadológicas, comitês macro, ICs
- Dados de NAV diário dos portfólios e AMCs Galapagos
- Dados de mercado em tempo real via tool fetch_live_asset_data

COMO RESPONDER:
Responda em português brasileiro com linguagem técnica de mercado financeiro. Seja direto, analítico e útil. Não seja excessivamente formal ou cheio de disclaimers.
Quando tiver dados suficientes, responda com confiança. Quando não tiver, diga claramente o que está faltando e sugira como obter.

FONTES:
- Para pesos e alocações atuais → Asset Dictionary (cite a Data Base)
- Para tese, estratégia, performance histórica → documentos indexados
- Para preços e dados de mercado em tempo real → tool fetch_live_asset_data
- Para NAV dos portfólios Galapagos → tabela daily_navs (disponível na Performance Analítica)
- Conflito entre fontes: documentos prevalecem para análise qualitativa; Asset Dictionary para pesos atuais

VEÍCULOS GALAPAGOS:
Os portfólios modelo investem em AMCs Galapagos (AMC Fixed Income XS3065236278, AMC Equities XS3064438362, AMC Alternatives XS2793259743) que por sua vez investem em ETFs UCITS e fundos. O Bond Portfolio é composto por bonds diretos.

ESTRUTURA HIERÁRQUICA (LOOK-THROUGH):
- Ativos com campo "amc_parent" são componentes internos de um AMC. O peso deles reflete a alocação DENTRO do AMC.
- Quando o usuário perguntar sobre composição de um AMC, mostre a estrutura look-through (AMC → ativos subjacentes).
- Os pesos do AMC no portfólio modelo multiplicados pelos pesos internos dão a exposição efetiva do portfólio a cada ativo subjacente.
- Sempre cite a Data Base ao informar pesos.

VISUALIZAÇÕES — use as tools para enriquecer respostas:
- renderizar_grafico_barras → comparações numéricas (retornos, pesos, drawdowns de 2+ itens)
- renderizar_flash_factsheet → perfil detalhado de um ativo específico
- renderizar_tabela_retornos → tabela de retornos mensais/anuais formatada
- renderizar_grafico_linha → evolução temporal de NAV ou performance acumulada
- renderizar_pie_chart → composição/alocação por classe ou portfólio

Use visualizações sempre que agregarem valor à análise. Não peça permissão — simplesmente chame a tool adequada junto com o texto explicativo.

Ao final de cada resposta analítica, sugira 2-3 perguntas de follow-up relevantes sob "💡 Explorar mais:".`;

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
