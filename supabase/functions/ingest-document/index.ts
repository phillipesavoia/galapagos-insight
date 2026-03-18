import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let documentId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

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

    // User-scoped client for DB operations (respects RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client ONLY for storage (private bucket requires elevated access)
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY");
    if (!dbKey) throw new Error("Missing DB_SERVICE_ROLE_KEY");
    const storageClient = createClient(supabaseUrl, dbKey);

    supabase = userClient;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    documentId = formData.get("document_id") as string;
    const documentName = formData.get("name") as string;
    const documentType = formData.get("type") as string;
    const fundName = formData.get("fund_name") as string;
    const period = formData.get("period") as string;

    if (!file || !documentId) {
      return new Response(
        JSON.stringify({ error: "file and document_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 0: Upload file to Supabase Storage bucket 'documents'
    console.log("Step 0: Uploading file to storage...");
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    // Sanitize filename: aggressively remove accents, special chars, collapse underscores
    const rawName = documentName || file.name || "document.pdf";
    const ext = rawName.lastIndexOf(".") > 0 ? rawName.slice(rawName.lastIndexOf(".")) : ".pdf";
    const baseName = rawName.slice(0, rawName.length - ext.length);
    const sanitizedBase = baseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
      .replace(/[^a-zA-Z0-9]/g, "_")     // everything non-alphanumeric → underscore
      .replace(/_+/g, "_")               // collapse multiple underscores
      .replace(/^_|_$/g, "");            // trim leading/trailing underscores
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
    const sanitizedName = (sanitizedBase || "document") + (sanitizedExt || ".pdf");
    const storagePath = `${documentId}/${sanitizedName}`;

    const { error: storageError } = await storageClient.storage
      .from("documents")
      .upload(storagePath, fileBytes, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

    const { data: urlData } = storageClient.storage.from("documents").getPublicUrl(storagePath);
    // Since bucket is private, generate a long-lived signed URL instead
    const { data: signedUrlData, error: signedUrlError } = await storageClient.storage
      .from("documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10); // 10 years

    const fileUrl = signedUrlError ? urlData.publicUrl : signedUrlData.signedUrl;

    // Save file_url to document record
    const { error: urlUpdateError } = await supabase
      .from("documents")
      .update({ file_url: fileUrl })
      .eq("id", documentId);

    if (urlUpdateError) console.error("Failed to update file_url:", urlUpdateError.message);
    console.log(`File uploaded to storage: ${storagePath}`);

    // STEP 1: Extract text with Reducto
    console.log("Step 1: Extracting text with Reducto...");
    const reductoKey = Deno.env.get("REDUCTO_API_KEY");
    if (!reductoKey) throw new Error("Missing REDUCTO_API_KEY");

    const blob = new Blob([fileBytes], { type: "application/pdf" });
    const formData2 = new FormData();
    formData2.append("file", blob, documentName || "document.pdf");

    const uploadRes = await fetch("https://platform.reducto.ai/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${reductoKey}` },
      body: formData2,
    });

    if (!uploadRes.ok) throw new Error(`Reducto upload failed [${uploadRes.status}]: ${await uploadRes.text()}`);
    const uploadData = await uploadRes.json();
    console.log("Reducto upload response:", JSON.stringify(uploadData));

    const file_id = uploadData.file_id ?? uploadData.url ?? uploadData.file_url;
    if (!file_id) throw new Error(`No file_id returned: ${JSON.stringify(uploadData)}`);

    const parseRes = await fetch("https://platform.reducto.ai/parse", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reductoKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document_url: file_id,
        options: { table_output_format: "markdown" },
      }),
    });

    if (!parseRes.ok) throw new Error(`Reducto parse failed [${parseRes.status}]: ${await parseRes.text()}`);

    const parseData = await parseRes.json();
    console.log("Parse response keys:", Object.keys(parseData));

    const result = parseData.result ?? parseData;
    let fullText = "";
    if (Array.isArray(result.chunks)) {
      fullText = result.chunks
        .map((chunk: any) => {
          if (typeof chunk.content === "string") return chunk.content;
          if (chunk.content?.markdown) return chunk.content.markdown;
          if (chunk.content?.text) return chunk.content.text;
          if (Array.isArray(chunk.blocks)) {
            return chunk.blocks.map((b: any) => b.content || "").join("\n");
          }
          return "";
        })
        .filter((t: string) => t.length > 0)
        .join("\n\n");
    } else if (typeof result.text === "string") {
      fullText = result.text;
    }

    console.log(`Extracted ${fullText.length} characters`);
    if (!fullText || fullText.length < 20) throw new Error("No text extracted from PDF");

    // STEP 2: Extract metadata with Gemini
    console.log("Step 2: Extracting metadata with Gemini...");
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!googleKey) throw new Error("Missing GOOGLE_AI_API_KEY");

    const geminiMetaRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this financial document and extract metadata.
Return ONLY a JSON object with these fields:
{
  "detected_fund_name": "full fund name or null",
  "detected_period": "YYYY-MM format or null",
  "detected_type": "factsheet|carta_mensal|apresentacao|outro",
  "detected_language": "pt-BR|en-US",
  "detected_ticker": "ticker symbol like DTLA, IBTA, etc. or null",
  "detected_isin": "ISIN code like IE00BFM6TC58 or null",
  "detected_exchange": "exchange code like LN (London), US, GR, etc. or null",
  "detected_ticker_exchange": "ticker with exchange like DTLA LN or null",
  "summary": "2-3 sentence summary in Portuguese",
  "key_metrics": {}
}

Document text (first 3000 chars):
${fullText.substring(0, 3000)}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    let extractedMetadata: Record<string, unknown> = {};
    if (geminiMetaRes.ok) {
      const geminiData = await geminiMetaRes.json();
      const metaText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      try {
        const clean = metaText.replace(/```json|```/g, "").trim();
        extractedMetadata = JSON.parse(clean);
      } catch {
        console.log("Metadata parse failed, continuing...");
      }
    } else {
      console.log(`Gemini metadata call failed [${geminiMetaRes.status}], continuing...`);
      await geminiMetaRes.text();
    }

    // STEP 3: Chunk the text (structure-aware)
    console.log("Step 3: Chunking text with structure preservation...");
    const maxChunkChars = 2000;
    const overlapChars = 200;

    // Split by structural boundaries (markdown headers, tables, double newlines)
    const sections = fullText.split(/\n(?=#{1,3}\s|\|[\s-|]+\||\n\n)/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // If adding this section would exceed limit, finalize current chunk
      if (currentChunk.length + trimmed.length > maxChunkChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Keep overlap from end of previous chunk for continuity
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlapChars / 5));
        currentChunk = overlapWords.join(" ") + "\n\n" + trimmed;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
      }

      // If a single section is too large, split it by paragraphs
      if (currentChunk.length > maxChunkChars) {
        const paragraphs = currentChunk.split(/\n\n+/);
        currentChunk = "";
        for (const para of paragraphs) {
          if (currentChunk.length + para.length > maxChunkChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = para;
          } else {
            currentChunk += (currentChunk ? "\n\n" : "") + para;
          }
        }
      }
    }
    if (currentChunk.trim().length > 50) chunks.push(currentChunk.trim());
    console.log(`Created ${chunks.length} structure-aware chunks`);

    // STEP 4: Generate embeddings
    console.log("Step 4: Generating embeddings...");
    const batchSize = 10;
    const allEmbeddings: { chunk: string; embedding: number[]; index: number }[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const globalIdx = i + batchIdx;
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
          if (!embRes.ok) {
            const errText = await embRes.text();
            throw new Error(`Embedding failed for chunk ${globalIdx} [${embRes.status}]: ${errText}`);
          }
          const embData = await embRes.json();
          return { chunk, embedding: embData.embedding.values as number[], index: globalIdx };
        })
      );
      allEmbeddings.push(...batchResults);
      if (i + batchSize < chunks.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // STEP 5: Store chunks in Supabase
    console.log("Step 5: Storing chunks in Supabase...");
    const chunkRecords = allEmbeddings.map(({ chunk, embedding, index }) => ({
      document_id: documentId,
      content: chunk,
      embedding: `[${embedding.join(",")}]`,
      chunk_index: index,
      metadata: {
        fund_name: fundName || (extractedMetadata as Record<string, unknown>).detected_fund_name,
        period: period || (extractedMetadata as Record<string, unknown>).detected_period,
        document_type: documentType,
        document_name: documentName,
      },
    }));

    for (let i = 0; i < chunkRecords.length; i += 50) {
      const batch = chunkRecords.slice(i, i + 50);
      const { error: chunksError } = await supabase.from("document_chunks").insert(batch);
      if (chunksError) throw new Error(`Failed to store chunks batch ${i}: ${chunksError.message}`);
    }

    // Update document status + metadata
    const meta = extractedMetadata as Record<string, unknown>;
    const updatePayload: Record<string, unknown> = {
      status: "indexed",
      chunk_count: chunks.length,
      metadata: extractedMetadata,
    };
    if (!fundName && meta.detected_fund_name) updatePayload.fund_name = meta.detected_fund_name;
    if (!period && meta.detected_period) updatePayload.period = meta.detected_period;
    if (meta.detected_language) updatePayload.language = meta.detected_language;

    const { error: updateError } = await supabase.from("documents").update(updatePayload).eq("id", documentId);
    if (updateError) throw new Error(`Failed to update document: ${updateError.message}`);

    console.log("Ingestion complete!");
    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        chunks_created: chunks.length,
        metadata: extractedMetadata,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ingest error:", error);
    if (documentId && supabase) {
      try {
        await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      } catch (e) {
        console.error("Failed to mark document as error:", e);
      }
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
