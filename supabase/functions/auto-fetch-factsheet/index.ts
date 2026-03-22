import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Type detection ---
function detectAssetType(ticker: string, name: string): "us_etf" | "ucits_etf" | "offshore_fund" | "bond" | "index" | "amc" | "manual" {
  const t = ticker.toUpperCase().trim();
  const n = name.toLowerCase().trim();
  if (n.includes("amc") || n.includes("opus")) return "amc";
  if (t.endsWith("INDEX") || t.endsWith(" INDEX")) return "index";
  if (t.endsWith("LN EQUITY") || t.endsWith(" LN")) return "ucits_etf";
  if (t.endsWith("ID EQUITY") || t.endsWith(" ID")) return "offshore_fund";
  if (t.endsWith("US EQUITY") || t.endsWith(" US")) return "us_etf";
  if (t.endsWith("CORP") || t.endsWith("GOVT")) return "bond";
  return "manual";
}


// --- Find factsheet from provider website using ISIN ---
async function findFactsheetFromProvider(isin: string, providerName: string): Promise<string | null> {
  const p = providerName.toLowerCase();

  if (p.includes("ishares") || p.includes("blackrock")) {
    const ukUrl = `https://www.ishares.com/uk/individual/en/literature/fact-sheet/${isin.toLowerCase()}-fund-fact-sheet-en-gb.pdf`;
    const ukTest = await fetch(ukUrl, { method: "HEAD" }).catch(() => null);
    if (ukTest?.ok) return ukUrl;

    const usUrl = `https://www.ishares.com/us/literature/fact-sheet/${isin.toLowerCase()}-fund-fact-sheet-en-us.pdf`;
    const usTest = await fetch(usUrl, { method: "HEAD" }).catch(() => null);
    if (usTest?.ok) return usUrl;
  }

  if (p.includes("vanguard")) {
    const url = `https://www.vanguard.co.uk/documents/portal/literature/${isin}-fund-fact-sheet.pdf`;
    const test = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (test?.ok) return url;
  }

  if (p.includes("invesco")) {
    const url = `https://etf.invesco.com/gb/private/en/literature/fact-sheet/${isin}-fund-fact-sheet-en-gb.pdf`;
    const test = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (test?.ok) return url;
  }

  if (p.includes("amundi") || p.includes("lyxor")) {
    const url = `https://www.amundietf.com/en/professional/product/view/isin/${isin}`;
    const html = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(r => r.text()).catch(() => "");
    const match = html.match(/href="([^"]+(?:factsheet|fact-sheet)[^"]*\.pdf[^"]*)"/i);
    if (match) return match[1].startsWith("http") ? match[1] : `https://www.amundietf.com${match[1]}`;
  }

  if (p.includes("spdr") || p.includes("state street")) {
    const url = `https://www.ssga.com/uk/en_gb/individual/etfs/funds/${isin}`;
    const html = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(r => r.text()).catch(() => "");
    const match = html.match(/href="([^"]+(?:factsheet|fact-sheet|fact_sheet)[^"]*\.pdf[^"]*)"/i);
    if (match) return match[1].startsWith("http") ? match[1] : `https://www.ssga.com${match[1]}`;
  }

  if (p.includes("franklin") || p.includes("templeton")) {
    const url = `https://www.franklintempleton.co.uk/investor/api/fund/factsheet/${isin}`;
    const test = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (test?.ok) return url;
  }

  if (p.includes("xtrackers") || p.includes("dws")) {
    const url = `https://etf.dws.com/en-gb/${isin}/factsheet/`;
    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
      .then(r => r.text()).catch(() => "");
    const match = html.match(/href="([^"]+\.pdf[^"]*)"/i);
    if (match) return match[1].startsWith("http") ? match[1] : `https://etf.dws.com${match[1]}`;
  }

  if (p.includes("aberdeen") || p.includes("abrdn")) {
    const url = `https://www.aberdeenstandard.com/docs?editionId=${isin}`;
    const test = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (test?.ok) return url;
  }

  return null;
}

// --- Yahoo Finance ETF data fetcher (US ETFs) ---
async function fetchYahooETFData(
  ticker: string,
  isin: string | null,
  name: string
): Promise<{ content: string; period: string } | null> {
  const period = new Date().toISOString().slice(0, 7);
  const cleanTicker = ticker
    .replace(/\s+US\s+EQUITY$/i, "")
    .replace(/\s+US$/i, "")
    .trim();

  try {
    // Yahoo Finance quote summary
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${cleanTicker}?modules=assetProfile,summaryDetail,fundProfile,topHoldings,fundPerformance,defaultKeyStatistics`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return null;

    const summary = result.summaryDetail || {};
    const profile = result.fundProfile || {};
    const keyStats = result.defaultKeyStatistics || {};
    const holdings = result.topHoldings || {};
    const perf = result.fundPerformance || {};

    // Format top holdings
    const topHoldings = (holdings.holdings || []).slice(0, 10)
      .map((h: any) => `  - ${h.holdingName || h.symbol}: ${h.holdingPercent ? (h.holdingPercent * 100).toFixed(2) + "%" : "N/A"}`)
      .join("\n");

    // Format performance
    const perfData = perf.trailingReturns || {};
    const ytd = perfData.ytd ? (perfData.ytd * 100).toFixed(2) + "%" : "N/A";
    const oneYear = perfData.oneYear ? (perfData.oneYear * 100).toFixed(2) + "%" : "N/A";
    const threeYear = perfData.threeYear ? (perfData.threeYear * 100).toFixed(2) + "%" : "N/A";
    const fiveYear = perfData.fiveYear ? (perfData.fiveYear * 100).toFixed(2) + "%" : "N/A";

    const content = `ETF FACT SHEET — ${name}

Ticker: ${cleanTicker}
ISIN: ${isin || "N/A"}
Generated: ${new Date().toLocaleDateString("pt-BR")}

FUND OVERVIEW
-------------
Name: ${name}
Category: ${profile.categoryName || "N/A"}
Family: ${profile.family || "N/A"}
Legal Type: ${profile.legalType || "ETF"}
Currency: ${summary.currency || "USD"}
Exchange: US Listed

FUND METRICS
------------
Total Assets (AUM): ${summary.totalAssets ? "$" + (summary.totalAssets / 1e9).toFixed(2) + "B" : "N/A"}
Expense Ratio (TER): ${summary.annualReportExpenseRatio ? (summary.annualReportExpenseRatio * 100).toFixed(2) + "%" : keyStats.annualHoldingsTurnover ? "N/A" : "N/A"}
52-Week High: ${summary.fiftyTwoWeekHigh?.raw ? "$" + summary.fiftyTwoWeekHigh.raw.toFixed(2) : "N/A"}
52-Week Low: ${summary.fiftyTwoWeekLow?.raw ? "$" + summary.fiftyTwoWeekLow.raw.toFixed(2) : "N/A"}
50-Day Average: ${summary.fiftyDayAverage?.raw ? "$" + summary.fiftyDayAverage.raw.toFixed(2) : "N/A"}
200-Day Average: ${summary.twoHundredDayAverage?.raw ? "$" + summary.twoHundredDayAverage.raw.toFixed(2) : "N/A"}
Beta (3Y): ${keyStats.beta3Year?.raw?.toFixed(2) || "N/A"}

PERFORMANCE
-----------
YTD Return: ${ytd}
1-Year Return: ${oneYear}
3-Year Return: ${threeYear}
5-Year Return: ${fiveYear}

${topHoldings ? `TOP HOLDINGS\n------------\n${topHoldings}` : ""}

PORTFOLIO
---------
This ETF is held within the Galapagos Capital model portfolios.
This is a US-listed ETF.

Source: Yahoo Finance public data.
`;

    return { content: content.replace(/\n{3,}/g, "\n\n").trim(), period };
  } catch (err) {
    console.error("Yahoo Finance fetch error:", err);
    return null;
  }
}

// --- Structured ETF data fallback (similar to bonds) ---
async function fetchETFStructuredData(
  ticker: string,
  isin: string | null,
  name: string,
  exchangeSuffix: string
): Promise<{ content: string; period: string } | null> {
  const period = new Date().toISOString().slice(0, 7);
  const cleanTicker = ticker
    .replace(/\s+LN\s+EQUITY$/i, "")
    .replace(/\s+US\s+EQUITY$/i, "")
    .replace(/\s+ID\s+EQUITY$/i, "")
    .replace(/\s+GR\s+EQUITY$/i, "")
    .replace(/\s+SW\s+EQUITY$/i, "")
    .replace(/\s+NA\s+EQUITY$/i, "")
    .replace(/\s+IM\s+EQUITY$/i, "")
    .replace(/\s+FP\s+EQUITY$/i, "")
    .replace(/\s+LX\s+EQUITY$/i, "")
    .replace(/\s+EQUITY$/i, "")
    .replace(/\s+CORP$/i, "")
    .replace(/\s+GOVT$/i, "")
    .replace(/\s+LN$/i, "")
    .replace(/\s+US$/i, "")
    .replace(/\s+ID$/i, "")
    .replace(/\s+GR$/i, "")
    .replace(/\s+SW$/i, "")
    .replace(/\s+NA$/i, "")
    .replace(/\s+IM$/i, "")
    .replace(/\s+FP$/i, "")
    .replace(/\s+LX$/i, "")
    .trim();

  let etfData: Record<string, string> = {
    name,
    ticker: cleanTicker,
    isin: isin || "N/A",
    exchange: exchangeSuffix,
  };

  // Try Morningstar search by ISIN or ticker
  try {
    const searchTerm = isin || cleanTicker;
    const msApiUrl = `https://www.morningstar.co.uk/uk/util/SecuritySearch.ashx?q=${encodeURIComponent(searchTerm)}&limit=1&source=nav`;

    const res = await fetch(msApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Referer": "https://www.morningstar.co.uk/",
      },
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        const result = Array.isArray(data) ? data[0] : data?.results?.[0];
        if (result) {
          etfData.name = result.Name || result.name || name;
          etfData.category = result.CategoryName || result.category || "";
          etfData.currency = result.Currency || result.currency || "";
          etfData.morningstarId = result.Id || result.id || "";
        }
      } catch (_) {}
    }
  } catch (_) {}

  // Try JustETF for additional data
  if (isin) {
    try {
      const justEtfUrl = `https://www.justetf.com/api/etfs?isin=${isin}&locale=en`;
      const res = await fetch(justEtfUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "application/json",
          "Referer": "https://www.justetf.com/",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const etf = data?.etfs?.[0];
        if (etf) {
          etfData.name = etf.name || etfData.name;
          etfData.ter = etf.ter ? `${etf.ter}%` : "";
          etfData.aum = etf.aum ? `${etf.aum} ${etf.currency || "USD"}` : "";
          etfData.replicationMethod = etf.replicationMethod || "";
          etfData.distributionPolicy = etf.distributionPolicy || "";
          etfData.domicile = etf.domicile || "";
          etfData.fundProvider = etf.providerName || etf.provider || "";
          etfData.index = etf.benchmarkName || etf.indexName || "";
          etfData.currency = etf.currency || etfData.currency;
          etfData.inceptionDate = etf.inceptionDate || "";
          etfData.numberOfHoldings = etf.numberOfHoldings ? String(etf.numberOfHoldings) : "";
        }
      }
    } catch (_) {}
  }

  const content = `ETF FACT SHEET

Name: ${etfData.name}
Ticker: ${etfData.ticker}
ISIN: ${etfData.isin}
Exchange: ${etfData.exchange}
${etfData.fundProvider ? `Provider: ${etfData.fundProvider}` : ""}
${etfData.index ? `Benchmark Index: ${etfData.index}` : ""}
${etfData.ter ? `Total Expense Ratio (TER): ${etfData.ter}` : ""}
${etfData.aum ? `Assets Under Management: ${etfData.aum}` : ""}
${etfData.currency ? `Currency: ${etfData.currency}` : ""}
${etfData.domicile ? `Domicile: ${etfData.domicile}` : ""}
${etfData.replicationMethod ? `Replication Method: ${etfData.replicationMethod}` : ""}
${etfData.distributionPolicy ? `Distribution Policy: ${etfData.distributionPolicy}` : ""}
${etfData.inceptionDate ? `Inception Date: ${etfData.inceptionDate}` : ""}
${etfData.numberOfHoldings ? `Number of Holdings: ${etfData.numberOfHoldings}` : ""}
${etfData.category ? `Morningstar Category: ${etfData.category}` : ""}

PORTFOLIO
---------
This ETF is held within the Galapagos Capital model portfolios.
${exchangeSuffix === "LN" || exchangeSuffix === "ID" ? "This is a UCITS ETF domiciled in Europe, accessible to offshore investors." : "This is a US-listed ETF."}

Generated: ${new Date().toLocaleDateString("pt-BR")}
Source: JustETF, Morningstar public data.
`;

  return { content: content.replace(/\n{3,}/g, "\n\n").trim(), period };
}

// --- Unified ETF/Fund fetcher ---
async function fetchETFFactsheet(
  ticker: string,
  isin: string | null,
  name: string,
  exchangeSuffix: string
): Promise<{ pdfUrl: string; period: string } | null> {
  const period = new Date().toISOString().slice(0, 7);

  // Extract clean ticker symbol (remove Bloomberg exchange suffix)
  const cleanTicker = ticker
    .replace(/\s+LN\s+EQUITY$/i, "")
    .replace(/\s+US\s+EQUITY$/i, "")
    .replace(/\s+ID\s+EQUITY$/i, "")
    .replace(/\s+GR\s+EQUITY$/i, "")
    .replace(/\s+SW\s+EQUITY$/i, "")
    .replace(/\s+NA\s+EQUITY$/i, "")
    .replace(/\s+IM\s+EQUITY$/i, "")
    .replace(/\s+FP\s+EQUITY$/i, "")
    .replace(/\s+LX\s+EQUITY$/i, "")
    .replace(/\s+EQUITY$/i, "")
    .replace(/\s+CORP$/i, "")
    .replace(/\s+GOVT$/i, "")
    .replace(/\s+LN$/i, "")
    .replace(/\s+US$/i, "")
    .replace(/\s+ID$/i, "")
    .replace(/\s+GR$/i, "")
    .replace(/\s+SW$/i, "")
    .replace(/\s+NA$/i, "")
    .replace(/\s+IM$/i, "")
    .replace(/\s+FP$/i, "")
    .replace(/\s+LX$/i, "")
    .trim();

  console.log("DEBUG cleanTicker:", cleanTicker, "| isin:", isin, "| exchangeSuffix:", exchangeSuffix, "| name:", name);

  // Step 1: Search JustETF by ticker symbol — works without ISIN
  try {
    const searchUrl = `https://www.justetf.com/api/etfs?search=${encodeURIComponent(cleanTicker)}&locale=en&assetClass=exchangeTradedFund`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
        "Referer": "https://www.justetf.com/en/find-etf.html",
      },
    });
    console.log("DEBUG justETF status:", res.status, "| ok:", res.ok);
    if (res.ok) {
      const data = await res.json();
      console.log("DEBUG justETF data:", JSON.stringify(data).slice(0, 500));
      const etfs = data?.etfs || [];

      // Find best match — prefer exact ticker symbol match
      const match = etfs.find((e: any) =>
        e.symbol?.toUpperCase() === cleanTicker.toUpperCase()
      ) || etfs[0];

      if (match) {
        const resolvedIsin = match.isin || isin;

        if (match.kiidUrl) return { pdfUrl: match.kiidUrl, period };
        if (match.factsheetUrl) return { pdfUrl: match.factsheetUrl, period };

        if (resolvedIsin) {
          const providerUrl = await findFactsheetFromProvider(
            resolvedIsin,
            match.providerName || match.name || name
          );
          if (providerUrl) return { pdfUrl: providerUrl, period };
        }
      }
    }
  } catch (_) {}

  // Step 2: If we have ISIN already, try provider directly
  if (isin) {
    const providerUrl = await findFactsheetFromProvider(isin, name);
    if (providerUrl) return { pdfUrl: providerUrl, period };
  }
  console.log("DEBUG isin check:", isin, "— skipping provider direct");

  // Step 3: US ETF fallback via ETF.com
  if (exchangeSuffix === "US") {
    try {
      const etfComUrl = `https://www.etf.com/${cleanTicker}`;
      const html = await fetch(etfComUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)" },
      }).then(r => r.text()).catch(() => "");
      const match = html.match(/href="([^"]+(?:fact[-_]?sheet|factsheet)[^"]*\.pdf)"/i);
      if (match) {
        const pdfUrl = match[1].startsWith("http")
          ? match[1]
          : `https://www.etf.com${match[1]}`;
        return { pdfUrl, period };
      }
    } catch (_) {}
  }

  // Step 4: iShares direct URL attempt using ISIN
  const nameLower = name.toLowerCase();
  if (nameLower.includes("ishares") && isin) {
    const isinLower = isin.toLowerCase();
    const urls = [
      `https://www.ishares.com/uk/individual/en/literature/fact-sheet/${isinLower}-fund-fact-sheet-en-gb.pdf`,
      `https://www.ishares.com/us/literature/fact-sheet/${isinLower}-fund-fact-sheet-en-us.pdf`,
    ];
    for (const url of urls) {
      const test = await fetch(url, { method: "HEAD" }).catch(() => null);
      if (test?.ok) return { pdfUrl: url, period };
    }
  }

  return null;
}


// --- Bond: build structured document from FINRA + OpenFIGI ---
async function fetchBondDocument(ticker: string, isin: string | null, name: string): Promise<{ content: string; period: string } | null> {
  let bondData: Record<string, string> = { name, ticker, isin: isin || "N/A" };

  // OpenFIGI lookup by ISIN
  if (isin) {
    try {
      const figiRes = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
      });
      if (figiRes.ok) {
        const figiData = await figiRes.json();
        const figi = figiData?.[0]?.data?.[0];
        if (figi) {
          bondData.name = figi.name || name;
          bondData.securityType = figi.securityType || "";
          bondData.securityType2 = figi.securityType2 || "";
          bondData.exchCode = figi.exchCode || "";
          bondData.marketSector = figi.marketSector || "";
        }
      }
    } catch (_) {}
  }

  // Build a structured text document (used as factsheet substitute)
  const content = `BOND FACT SHEET

ISIN: ${isin || "N/A"}
Name: ${bondData.name}
Ticker: ${ticker}
Security Type: ${bondData.securityType || "Corporate Bond"}
Market Sector: ${bondData.marketSector || "Corporate"}
Exchange: ${bondData.exchCode || "N/A"}
Generated: ${new Date().toLocaleDateString("pt-BR")}

PORTFOLIO
---------
This bond is a direct bond holding in the Galapagos Capital Bond Portfolio.
ISIN identifier: ${isin || "N/A"}

SOURCE
------
Data sourced from OpenFIGI public API.
For full terms, covenants, coupon, maturity and pricing, 
refer to Bloomberg Terminal or the issuer Investor Relations page.
`;

  return { content, period: new Date().toISOString().slice(0, 7) };
}




Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { asset_id, ticker, isin, name } = await req.json();
    if (!ticker || !name) {
      return new Response(JSON.stringify({ error: "ticker and name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assetType = detectAssetType(ticker, name);

    // Skip AMCs and manual
    if (assetType === "amc") {
      return new Response(JSON.stringify({ status: "skipped", reason: "AMC vehicle — no external factsheet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (assetType === "index") {
      return new Response(JSON.stringify({ status: "skipped", reason: "Bloomberg index — used for replication only, no factsheet needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (assetType === "manual") {
      return new Response(JSON.stringify({ status: "manual", reason: "Alternative fund — requires manual upload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if a recent factsheet already exists (indexed within last 25 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 25);
    const lookupValue = (assetType === "bond" && isin) ? isin : name;
    const lookupColumn = (assetType === "bond" && isin) ? "fund_name" : "fund_name";
    const { data: existing } = await supabase
      .from("documents")
      .select("id, uploaded_at")
      .eq("fund_name", lookupValue)
      .eq("type", "factsheet")
      .in("status", ["indexed", "processing"])
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ status: "skipped", reason: "Recent factsheet already indexed", document_id: existing[0].id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For bonds: create structured text document instead of PDF
    if (assetType === "bond") {
      const bondDoc = await fetchBondDocument(ticker, isin, name);
      if (!bondDoc) {
        return new Response(
          JSON.stringify({ status: "error", reason: "Could not build bond document" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const safeBondName = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
      const bondIdentifier = isin || name;
      const docName = `${isin ? isin + " — " : ""}${safeBondName} Bond Data`;

      const { data: doc, error: insertErr } = await supabase
        .from("documents")
        .insert({
          name: docName,
          type: "factsheet",
          fund_name: bondIdentifier,
          period: bondDoc.period,
          status: "processing",
          owner_id: null,
        })
        .select()
        .single();

      if (insertErr || !doc) throw new Error("Failed to insert bond document: " + insertErr?.message);

      const indexBondAsync = async () => {
        try {
          const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
          if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY");

          const text = bondDoc.content;
          const paragraphs = text.split(/\n\n+/);
          const chunks: string[] = [];
          let current = "";

          for (const para of paragraphs) {
            if (current.length + para.length > 1500 && current.length > 0) {
              chunks.push(current.trim());
              current = para;
            } else {
              current += (current ? "\n\n" : "") + para;
            }
          }
          if (current.trim().length > 20) chunks.push(current.trim());

          if (chunks.length === 0) {
            await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
            return;
          }

          const embeddedChunks: { chunk: string; embedding: number[]; index: number }[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const embRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: { parts: [{ text: chunks[i] }] },
                  outputDimensionality: 768,
                }),
              }
            );
            if (!embRes.ok) continue;
            const embData = await embRes.json();
            embeddedChunks.push({
              chunk: chunks[i],
              embedding: embData.embedding.values,
              index: i,
            });
          }

          const chunkRecords = embeddedChunks.map(({ chunk, embedding, index }) => ({
            document_id: doc.id,
            content: chunk,
            embedding: `[${embedding.join(",")}]`,
            chunk_index: index,
            metadata: {
              fund_name: bondIdentifier,
              isin: isin || null,
              period: bondDoc.period,
              document_type: "factsheet",
              document_name: docName,
            },
          }));

          if (chunkRecords.length > 0) {
            await supabase.from("document_chunks").insert(chunkRecords);
          }

          await supabase.from("documents").update({
            status: "indexed",
            chunk_count: chunkRecords.length,
            language: "en-US",
          }).eq("id", doc.id);

          console.log(`Bond indexed: ${bondIdentifier} — ${chunkRecords.length} chunks`);

        } catch (err) {
          console.error("Bond indexing error:", err);
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
        }
      };

      indexBondAsync().catch(console.error);

      return new Response(
        JSON.stringify({ 
          status: "processing", 
          document_id: doc.id, 
          type: "bond_structured", 
          name,
          isin: isin || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For ETFs: find and download PDF
    let fetchResult: { pdfUrl: string; period: string } | null = null;
    const tickerUpper = ticker.toUpperCase();
    const exchangeSuffix = 
      tickerUpper.includes(" LN") ? "LN"
      : tickerUpper.includes(" ID") ? "ID"
      : tickerUpper.includes(" LX") ? "LX"
      : tickerUpper.includes(" GR") ? "GR"
      : tickerUpper.includes(" SW") ? "SW"
      : tickerUpper.includes(" NA") ? "NA"
      : tickerUpper.includes(" IM") ? "IM"
      : tickerUpper.includes(" FP") ? "FP"
      : tickerUpper.includes(" US") ? "US"
      : "US";
    if (assetType === "us_etf" || assetType === "ucits_etf" || assetType === "offshore_fund") {
      fetchResult = await fetchETFFactsheet(ticker, isin, name, exchangeSuffix);
    }

    // If PDF not found, try Yahoo Finance for US ETFs first
    if (!fetchResult && assetType === "us_etf") {
      const yahooData = await fetchYahooETFData(ticker, isin, name);
      if (yahooData) {
        const safeETFName = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
        const etfIdentifier = isin || name;
        const docName = `${isin ? isin + " — " : ""}${safeETFName} ETF Data`;

        const { data: doc, error: insertErr } = await supabase
          .from("documents")
          .insert({
            name: docName,
            type: "factsheet",
            fund_name: etfIdentifier,
            period: yahooData.period,
            status: "processing",
            owner_id: null,
          })
          .select()
          .single();

        if (!insertErr && doc) {
          const indexAsync = async () => {
            try {
              const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
              if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY");

              const paragraphs = yahooData.content.split(/\n\n+/);
              const chunks: string[] = [];
              let current = "";

              for (const para of paragraphs) {
                if (current.length + para.length > 1500 && current.length > 0) {
                  chunks.push(current.trim());
                  current = para;
                } else {
                  current += (current ? "\n\n" : "") + para;
                }
              }
              if (current.trim().length > 20) chunks.push(current.trim());

              const embeddedChunks: { chunk: string; embedding: number[]; index: number }[] = [];

              for (let i = 0; i < chunks.length; i++) {
                const embRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      content: { parts: [{ text: chunks[i] }] },
                      outputDimensionality: 768,
                    }),
                  }
                );
                if (!embRes.ok) continue;
                const embData = await embRes.json();
                embeddedChunks.push({ chunk: chunks[i], embedding: embData.embedding.values, index: i });
              }

              const chunkRecords = embeddedChunks.map(({ chunk, embedding, index }) => ({
                document_id: doc.id,
                content: chunk,
                embedding: `[${embedding.join(",")}]`,
                chunk_index: index,
                metadata: {
                  fund_name: etfIdentifier,
                  isin: isin || null,
                  period: yahooData.period,
                  document_type: "factsheet",
                  document_name: docName,
                },
              }));

              if (chunkRecords.length > 0) {
                await supabase.from("document_chunks").insert(chunkRecords);
              }

              await supabase.from("documents").update({
                status: "indexed",
                chunk_count: chunkRecords.length,
                language: "en-US",
              }).eq("id", doc.id);

              console.log(`Yahoo ETF indexed: ${etfIdentifier} — ${chunkRecords.length} chunks`);
            } catch (err) {
              console.error("Yahoo ETF indexing error:", err);
              await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
            }
          };

          indexAsync().catch(console.error);

          return new Response(
            JSON.stringify({ status: "processing", document_id: doc.id, type: "us_etf_yahoo", name, isin: isin || null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Final fallback: generic structured data for UCITS/offshore
    if (!fetchResult) {
      const structuredData = await fetchETFStructuredData(ticker, isin, name, exchangeSuffix);
      if (!structuredData) {
        return new Response(
          JSON.stringify({ status: "not_found", reason: "Could not locate factsheet or structured data", ticker, type: assetType }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Index structured ETF data directly (same pipeline as bonds)
      const safeETFName = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
      const etfIdentifier = isin || name;
      const docName = `${isin ? isin + " — " : ""}${safeETFName} ETF Data`;

      const { data: doc, error: insertErr } = await supabase
        .from("documents")
        .insert({
          name: docName,
          type: "factsheet",
          fund_name: etfIdentifier,
          period: structuredData.period,
          status: "processing",
          owner_id: null,
        })
        .select()
        .single();

      if (insertErr || !doc) throw new Error("Failed to insert ETF document");

      const indexETFAsync = async () => {
        try {
          const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
          if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY");

          const paragraphs = structuredData.content.split(/\n\n+/);
          const chunks: string[] = [];
          let current = "";

          for (const para of paragraphs) {
            if (current.length + para.length > 1500 && current.length > 0) {
              chunks.push(current.trim());
              current = para;
            } else {
              current += (current ? "\n\n" : "") + para;
            }
          }
          if (current.trim().length > 20) chunks.push(current.trim());

          const embeddedChunks: { chunk: string; embedding: number[]; index: number }[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const embRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: { parts: [{ text: chunks[i] }] },
                  outputDimensionality: 768,
                }),
              }
            );
            if (!embRes.ok) continue;
            const embData = await embRes.json();
            embeddedChunks.push({ chunk: chunks[i], embedding: embData.embedding.values, index: i });
          }

          const chunkRecords = embeddedChunks.map(({ chunk, embedding, index }) => ({
            document_id: doc.id,
            content: chunk,
            embedding: `[${embedding.join(",")}]`,
            chunk_index: index,
            metadata: {
              fund_name: etfIdentifier,
              isin: isin || null,
              period: structuredData.period,
              document_type: "factsheet",
              document_name: docName,
            },
          }));

          if (chunkRecords.length > 0) {
            await supabase.from("document_chunks").insert(chunkRecords);
          }

          await supabase.from("documents").update({
            status: "indexed",
            chunk_count: chunkRecords.length,
            language: "en-US",
          }).eq("id", doc.id);

          console.log(`ETF structured data indexed: ${etfIdentifier} — ${chunkRecords.length} chunks`);
        } catch (err) {
          console.error("ETF structured indexing error:", err);
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
        }
      };

      indexETFAsync().catch(console.error);

      return new Response(
        JSON.stringify({ status: "processing", document_id: doc.id, type: "etf_structured", name, isin: isin || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeName = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();

    // Insert document record
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        name: `${safeName} — Factsheet ${fetchResult.period}`,
        type: "factsheet",
        fund_name: name,
        period: fetchResult.period,
        status: "processing",
        owner_id: null,
      })
      .select()
      .single();

    if (insertErr || !doc) throw new Error("Failed to insert document: " + insertErr?.message);

    // Use Reducto URL parsing — pass the PDF URL directly instead of downloading
    const reductoKey = Deno.env.get("REDUCTO_API_KEY");
    if (!reductoKey) throw new Error("Missing REDUCTO_API_KEY");

    // Fire Reducto parse by URL (async — do not await response)
    const reductoParseAsync = async () => {
      try {
        // Upload URL to Reducto
        const uploadRes = await fetch("https://platform.reducto.ai/parse", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${reductoKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document_url: fetchResult.pdfUrl,
            options: { table_output_format: "markdown" },
          }),
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          console.error("Reducto parse failed:", uploadRes.status, errText);
          
          // Fallback: use structured data from JustETF/Morningstar
          console.log("Falling back to structured ETF data...");
          const structuredData = await fetchETFStructuredData(ticker, isin, name, exchangeSuffix);
          if (structuredData) {
            const paragraphs = structuredData.content.split(/\n\n+/);
            const chunks: string[] = [];
            let current = "";
            for (const para of paragraphs) {
              if (current.length + para.length > 1500 && current.length > 0) {
                chunks.push(current.trim());
                current = para;
              } else {
                current += (current ? "\n\n" : "") + para;
              }
            }
            if (current.trim().length > 20) chunks.push(current.trim());

            const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
            if (googleKey && chunks.length > 0) {
              const embeddedChunks: { chunk: string; embedding: number[]; index: number }[] = [];
              for (let i = 0; i < chunks.length; i++) {
                const embRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      content: { parts: [{ text: chunks[i] }] },
                      outputDimensionality: 768,
                    }),
                  }
                );
                if (!embRes.ok) continue;
                const embData = await embRes.json();
                embeddedChunks.push({ chunk: chunks[i], embedding: embData.embedding.values, index: i });
              }

              const chunkRecords = embeddedChunks.map(({ chunk, embedding, index }) => ({
                document_id: doc.id,
                content: chunk,
                embedding: `[${embedding.join(",")}]`,
                chunk_index: index,
                metadata: {
                  fund_name: isin || name,
                  isin: isin || null,
                  period: structuredData.period,
                  document_type: "factsheet",
                  document_name: doc.name,
                },
              }));

              if (chunkRecords.length > 0) {
                await supabase.from("document_chunks").insert(chunkRecords);
              }

              await supabase.from("documents").update({
                status: "indexed",
                chunk_count: chunkRecords.length,
                language: "en-US",
                file_url: fetchResult.pdfUrl,
              }).eq("id", doc.id);

              console.log(`ETF fallback indexed: ${isin || name} — ${chunkRecords.length} chunks`);
              return;
            }
          }
          
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
          return;
        }

        const parseData = await uploadRes.json();
        const result = parseData.result ?? parseData;

        let fullText = "";
        if (Array.isArray(result.chunks)) {
          fullText = result.chunks
            .map((chunk: any) => {
              if (typeof chunk.content === "string") return chunk.content;
              if (chunk.content?.markdown) return chunk.content.markdown;
              if (chunk.content?.text) return chunk.content.text;
              return "";
            })
            .filter((t: string) => t.length > 0)
            .join("\n\n");
        } else if (typeof result.text === "string") {
          fullText = result.text;
        }

        if (!fullText || fullText.length < 20) {
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
          return;
        }

        // Generate embeddings and store chunks using Google Gemini
        const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
        if (!googleKey) {
          await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
          return;
        }

        // Chunk text
        const maxChunkChars = 2000;
        const chunks: string[] = [];
        const paragraphs = fullText.split(/\n\n+/);
        let currentChunk = "";

        for (const para of paragraphs) {
          if (currentChunk.length + para.length > maxChunkChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = para;
          } else {
            currentChunk += (currentChunk ? "\n\n" : "") + para;
          }
        }
        if (currentChunk.trim().length > 50) chunks.push(currentChunk.trim());

        // Generate embeddings in batches
        const batchSize = 10;
        const allEmbeddings: { chunk: string; embedding: number[]; index: number }[] = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const results = await Promise.all(batch.map(async (chunk, bi) => {
            const embRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: { parts: [{ text: chunk }] },
                  outputDimensionality: 768,
                }),
              }
            );
            if (!embRes.ok) return null;
            const embData = await embRes.json();
            return { chunk, embedding: embData.embedding.values as number[], index: i + bi };
          }));
          allEmbeddings.push(...results.filter(Boolean) as any[]);
          if (i + batchSize < chunks.length) await new Promise(r => setTimeout(r, 200));
        }

        // Store chunks
        const chunkRecords = allEmbeddings.map(({ chunk, embedding, index }) => ({
          document_id: doc.id,
          content: chunk,
          embedding: `[${embedding.join(",")}]`,
          chunk_index: index,
          metadata: { fund_name: name, period: fetchResult.period, document_type: "factsheet", document_name: `${safeName} — Factsheet ${fetchResult.period}` },
        }));

        for (let i = 0; i < chunkRecords.length; i += 50) {
          await supabase.from("document_chunks").insert(chunkRecords.slice(i, i + 50));
        }

        // Update document status
        await supabase.from("documents").update({
          status: "indexed",
          chunk_count: chunks.length,
          file_url: fetchResult.pdfUrl,
        }).eq("id", doc.id);

        console.log(`Successfully indexed ${chunks.length} chunks for ${name}`);

      } catch (err) {
        console.error("Async indexing error:", err);
        await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
      }
    };

    // Fire async — do not await
    reductoParseAsync().catch(console.error);

    return new Response(JSON.stringify({
      status: "processing",
      document_id: doc.id,
      type: assetType,
      pdf_url: fetchResult.pdfUrl,
      name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auto-fetch-factsheet error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
