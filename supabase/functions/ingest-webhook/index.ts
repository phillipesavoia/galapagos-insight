import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const FOLDER_TYPE_MAP: Record<string, string> = {
  comites: "apresentacao",
  factsheets: "factsheet",
  relatorios: "relatorio",
  apresentacoes: "apresentacao",
};

function extractPeriod(fileName: string): string | null {
  // Match YYYY-MM or YYYY_MM patterns
  const match = fileName.match(/(\d{4})[-_](\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  // Match month names in Portuguese
  const months: Record<string, string> = {
    janeiro: "01", fevereiro: "02", marco: "03", março: "03",
    abril: "04", maio: "05", junho: "06", julho: "07",
    agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  };
  const lower = fileName.toLowerCase();
  for (const [name, num] of Object.entries(months)) {
    if (lower.includes(name)) {
      const yearMatch = lower.match(/(\d{4})/);
      if (yearMatch) return `${yearMatch[1]}-${num}`;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth via x-api-key header
    const apiKey = req.headers.get("x-api-key");
    const webhookKey = Deno.env.get("INGEST_WEBHOOK_KEY");
    if (!webhookKey || apiKey !== webhookKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse input (JSON or form-data)
    let fileUrl: string;
    let fileName: string;
    let fileType: string;
    let folder: string;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      fileUrl = formData.get("file_url") as string;
      fileName = formData.get("file_name") as string;
      fileType = formData.get("file_type") as string || "pdf";
      folder = formData.get("folder") as string;
    } else {
      const body = await req.json();
      fileUrl = body.file_url;
      fileName = body.file_name;
      fileType = body.file_type || "pdf";
      folder = body.folder;
    }

    if (!fileUrl || !fileName || !folder) {
      return new Response(
        JSON.stringify({ error: "file_url, file_name, and folder are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine document type
    const docType = FOLDER_TYPE_MAP[folder.toLowerCase()] || "outro";
    const period = extractPeriod(fileName);

    // Supabase service role client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Download file from URL
    console.log(`Downloading file from: ${fileUrl}`);
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download file: ${fileRes.status} ${fileRes.statusText}`);
    }
    const fileBytes = new Uint8Array(await fileRes.arrayBuffer());
    const mimeType = fileType === "pptx"
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : "application/pdf";

    // Insert document record
    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        name: fileName,
        type: docType,
        status: "processing",
        period,
      })
      .select("id")
      .single();

    if (insertError || !doc) {
      throw new Error(`Failed to insert document: ${insertError?.message}`);
    }
    const documentId = doc.id;
    console.log(`Created document record: ${documentId}`);

    // Upload to storage
    const sanitizedName = fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    const storagePath = `${documentId}/${sanitizedName}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // Get signed URL
    const { data: signedUrlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    const storageUrl = signedUrlData?.signedUrl || "";

    // Update document with file_url
    await supabase
      .from("documents")
      .update({ file_url: storageUrl })
      .eq("id", documentId);

    console.log(`File uploaded to storage: ${storagePath}`);

    // Call ingest-document to process chunks/embeddings
    const formData = new FormData();
    const blob = new Blob([fileBytes], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("document_id", documentId);
    formData.append("name", fileName);
    formData.append("type", docType);
    formData.append("fund_name", "");
    formData.append("period", period || "");

    const ingestUrl = `${supabaseUrl}/functions/v1/ingest-document`;
    fetch(ingestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: formData,
    }).catch((err) => console.error("Failed to call ingest-document:", err));

    return new Response(
      JSON.stringify({ success: true, document_id: documentId, type: docType, period }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
