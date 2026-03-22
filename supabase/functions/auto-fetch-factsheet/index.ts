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
    .replace(/\s+LN$/i, "")
    .replace(/\s+US$/i, "")
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
  const content = `BOND FACT SHEET — ${bondData.name}
Generated: ${new Date().toLocaleDateString("pt-BR")}

IDENTIFICATION
--------------
Name: ${bondData.name}
Ticker: ${ticker}
ISIN: ${bondData.isin}
Security Type: ${bondData.securityType || "Corporate Bond"}
Market Sector: ${bondData.marketSector || "Corporate"}

PORTFOLIO
---------
This bond is part of the Galapagos Capital Bond Portfolio.
It is a direct bond holding (not a fund or ETF).

SOURCE
------
Data sourced from OpenFIGI public API.
For full terms, covenants and pricing, refer to Bloomberg Terminal or the issuer's Investor Relations page.
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
    const { data: existing } = await supabase
      .from("documents")
      .select("id, uploaded_at")
      .ilike("fund_name", `%${name.substring(0, 12)}%`)
      .eq("type", "factsheet")
      .eq("status", "indexed")
      .gte("uploaded_at", cutoff.toISOString())
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
        return new Response(JSON.stringify({ status: "error", reason: "Could not build bond document" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert document record
      const { data: doc, error: insertErr } = await supabase
        .from("documents")
        .insert({
          name: `${name} — Bond Data`,
          type: "factsheet",
          fund_name: name,
          period: bondDoc.period,
          status: "processing",
          owner_id: null,
        })
        .select()
        .single();

      if (insertErr || !doc) throw new Error("Failed to insert document record");

      // Create a text blob as a fake PDF upload
      const textEncoder = new TextEncoder();
      const textBytes = textEncoder.encode(bondDoc.content);
      const blob = new Blob([textBytes], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, `${name.replace(/[^a-zA-Z0-9]/g, "_")}_bond_data.txt`);
      formData.append("document_id", doc.id);
      formData.append("name", `${name} — Bond Data`);
      formData.append("type", "factsheet");
      formData.append("fund_name", name);
      formData.append("period", bondDoc.period);

      const ingestUrl = `${supabaseUrl}/functions/v1/ingest-document`;
      fetch(ingestUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
        body: formData,
      }).catch(console.error);

      return new Response(JSON.stringify({ status: "processing", document_id: doc.id, type: "bond_structured", name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For ETFs: find and download PDF
    let fetchResult: { pdfUrl: string; period: string } | null = null;
    const exchangeSuffix = ticker.toUpperCase().includes(" LN") ? "LN"
      : ticker.toUpperCase().includes(" ID") ? "ID"
      : ticker.toUpperCase().includes(" US") ? "US"
      : ticker.toUpperCase().includes(" GR") ? "GR"
      : ticker.toUpperCase().includes(" SW") ? "SW"
      : ticker.toUpperCase().includes(" NA") ? "NA"
      : ticker.toUpperCase().includes(" IM") ? "IM"
      : ticker.toUpperCase().includes(" FP") ? "FP"
      : "US";
    if (assetType === "us_etf" || assetType === "ucits_etf" || assetType === "offshore_fund") {
      fetchResult = await fetchETFFactsheet(ticker, isin, name, exchangeSuffix);
    }

    if (!fetchResult) {
      return new Response(JSON.stringify({ status: "not_found", reason: "Could not locate factsheet URL", ticker, type: assetType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = await downloadPDF(fetchResult.pdfUrl);
    if (!pdfBytes) {
      return new Response(JSON.stringify({ status: "error", reason: "PDF download failed", url: fetchResult.pdfUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert document record
    const safeName = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
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

    // Fire ingest-document (async — do not await)
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", blob, `${safeName.replace(/\s/g, "_")}_factsheet.pdf`);
    formData.append("document_id", doc.id);
    formData.append("name", `${safeName} — Factsheet ${fetchResult.period}`);
    formData.append("type", "factsheet");
    formData.append("fund_name", name);
    formData.append("period", fetchResult.period);

    const ingestUrl = `${supabaseUrl}/functions/v1/ingest-document`;
    fetch(ingestUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
      body: formData,
    }).catch(console.error);

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
