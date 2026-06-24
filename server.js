/**
 * server.js
 *
 * Express server that provides:
 *   GET  /api/templates   → list templates: Documenso API merged with config.js
 *   GET  /api/folders     → list folders: Documenso API + config default
 *   POST /api/merge       → SSE stream: fetch, merge (pdf-lib), upload
 *
 * In production (Railway) the built React app in client/dist is served statically.
 * In local dev, run `npm run dev:client` separately on port 3000 which proxies here.
 */

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import FormData from "form-data";
import { PDFDocument } from "pdf-lib";

import {
  DOCUMENSO_API_TOKEN,
  DOCUMENSO_BASE_URL,
  DOCUMENSO_FOLDER_ID,
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_BUCKET,
  TEMPLATES,
} from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

// ─── Serve built React app in production ──────────────────────────────────
const clientDist = path.join(__dirname, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ═════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═════════════════════════════════════════════════════════════════════════

/**
 * Fetch all templates from Documenso API (handles pagination).
 * Returns an empty array on failure so the caller can fall back gracefully.
 */
async function fetchAllDocumensoTemplates(folderId) {
  const all = [];
  let page = 1;
  const perPage = 50;
  const maxPages = 20; // safety cap — 1 000 templates

  try {
    while (page <= maxPages) {
      let url = `${DOCUMENSO_BASE_URL}/template?page=${page}&perPage=${perPage}`;
      if (folderId && folderId !== 'all') {
        url += `&folderId=${folderId}`;
      }
      const res = await fetch(
        url,
        { headers: { Authorization: `Bearer ${DOCUMENSO_API_TOKEN}` } }
      );
      if (!res.ok) break;

      const data = await res.json();
      // Documenso v2 wraps results in .templates; some builds use .data
      const items = data.templates ?? data.data ?? [];
      all.push(...items);

      if (items.length < perPage) break; // last page reached
      page++;
    }
  } catch (err) {
    console.warn("[/api/templates] Documenso API fetch failed:", err.message);
  }

  return all;
}

/**
 * Fetch all folders from Documenso API.
 * Returns an empty array on failure.
 */
async function fetchAllDocumensoFolders() {
  const all = [];
  let page = 1;
  const perPage = 100;
  const maxPages = 20;

  try {
    while (page <= maxPages) {
      const res = await fetch(`${DOCUMENSO_BASE_URL}/folder?page=${page}&perPage=${perPage}`, {
        headers: { Authorization: `Bearer ${DOCUMENSO_API_TOKEN}` },
      });
      if (!res.ok) break;

      const data = await res.json();
      const items = data.folders ?? data.data ?? [];
      all.push(
        ...items.map((f) => ({
          id: f.id,
          name: f.name ?? f.title ?? `Folder ${f.id}`,
        }))
      );

      if (items.length < perPage) break;
      page++;
    }
  } catch (err) {
    console.warn("[/api/folders] Documenso API fetch failed:", err.message);
  }
  
  // Sort alphabetically for a more seamless picker
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch a single Documenso template (fields + recipients + S3 path).
 */
async function fetchDocumensoTemplate(templateId) {
  const res = await fetch(`${DOCUMENSO_BASE_URL}/template/${templateId}`, {
    headers: { Authorization: `Bearer ${DOCUMENSO_API_TOKEN}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Documenso fetch failed for template ${templateId}: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Download a PDF from Supabase private storage via a signed URL.
 * Returns a Buffer.
 */
async function downloadPDFBuffer(template) {
  const s3Path = template.templateDocumentData?.data;
  if (!s3Path) {
    throw new Error(`Template ${template.id} has no templateDocumentData.data`);
  }

  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${s3Path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 }),
    }
  );

  if (!signRes.ok) {
    const err = await signRes.text();
    throw new Error(`Supabase sign failed for "${s3Path}": ${signRes.status} ${err}`);
  }

  const { signedURL } = await signRes.json();
  if (!signedURL) throw new Error(`No signedURL returned for "${s3Path}"`);

  const fullURL = `${SUPABASE_URL}/storage/v1${signedURL}`;
  const pdfRes = await fetch(fullURL);
  if (!pdfRes.ok) {
    throw new Error(`PDF download failed: ${pdfRes.status} ${pdfRes.statusText}`);
  }
  return pdfRes.buffer();
}

/**
 * Merge an array of PDF buffers into one using pdf-lib.
 * Returns a Buffer.
 */
async function mergePDFBuffers(pdfBuffers) {
  const merged = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}

/**
 * Get the page count of a PDF buffer.
 */
async function getPageCount(pdfBuffer) {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * Build the Documenso envelope payload, offsetting field page numbers.
 */
function buildPayload(templateEntries, title, folderId) {
  const recipientMap = new Map();
  let nextSigningOrder = 1;

  for (const { template, pageOffset } of templateEntries) {
    const recipientRoleMap = new Map();
    for (const r of template.recipients ?? []) {
      const roleName = r.name?.trim() || r.role || `Signer ${r.signingOrder}`;
      recipientRoleMap.set(r.id, roleName);
    }

    for (const field of template.fields ?? []) {
      const roleName = recipientRoleMap.get(field.recipientId) ?? "Signer 1";
      if (!recipientMap.has(roleName)) {
        recipientMap.set(roleName, {
          name: roleName,
          email: "",
          role: "SIGNER",
          signingOrder: nextSigningOrder++,
          fields: [],
        });
      }
      recipientMap.get(roleName).fields.push({
        identifier: 0,
        type: field.type,
        page: Number(field.page) + pageOffset,
        positionX: parseFloat(field.positionX),
        positionY: parseFloat(field.positionY),
        width: parseFloat(field.width),
        height: parseFloat(field.height),
        ...(field.fieldMeta ? { fieldMeta: field.fieldMeta } : {}),
      });
    }
  }

  return {
    type: "TEMPLATE",
    title,
    folderId: folderId || DOCUMENSO_FOLDER_ID,
    meta: {
      timezone: "Asia/Makassar",
      dateFormat: "dd/MM/yyyy",
      signingOrder: "SEQUENTIAL",
      language: "en",
      typedSignatureEnabled: true,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: true,
    },
    recipients: Array.from(recipientMap.values()),
  };
}

/**
 * Upload merged PDF + metadata to Documenso as a new template.
 */
async function createDocumensoTemplate(templateEntries, mergedPdfBuffer, title, folderId) {
  const payload = buildPayload(templateEntries, title, folderId);
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("files", mergedPdfBuffer, {
    filename: "merged.pdf",
    contentType: "application/pdf",
  });

  const res = await fetch(`${DOCUMENSO_BASE_URL}/envelope/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DOCUMENSO_API_TOKEN}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const responseText = await res.text();
  if (!res.ok) throw new Error(`Documenso API error ${res.status}: ${responseText}`);

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Could not parse API response: ${responseText}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// API Routes
// ═════════════════════════════════════════════════════════════════════════

/**
 * GET /api/templates
 *
 * Returns a merged list of templates:
 *   - First, fetches all templates from the Documenso API (real titles, all visible templates)
 *   - Then enriches any templates that match a config.js key with that key label
 *   - Templates in config.js but missing from the API are still included as fallback
 *
 * Response shape:
 *   { templates: [{ id, title, configKey?, source: 'api'|'config' }] }
 */
app.get("/api/templates", async (req, res) => {
  const { folderId, source } = req.query;
  // Build a config ID → key map for enrichment
  const configByKey = Object.entries(TEMPLATES); // [[key, {id}], ...]
  const configById = new Map(configByKey.map(([key, val]) => [val.id, key]));

  if (source === 'config') {
    const fallback = configByKey.map(([key, val]) => ({
      id: val.id,
      title: key,
      configKey: key,
      source: "config",
    }));
    return res.json({ templates: fallback, defaultFolderId: DOCUMENSO_FOLDER_ID });
  }

  // Fetch from Documenso API
  const apiTemplates = await fetchAllDocumensoTemplates(folderId);

  if (apiTemplates.length > 0 || (folderId && folderId !== 'all')) {
    // Merge: API templates (real title) enriched with configKey if known
    const apiSet = new Set(apiTemplates.map((t) => t.id));

    const merged = [
      ...apiTemplates.map((t) => ({
        id: t.id,
        title: t.title ?? `Template ${t.id}`,
        configKey: configById.get(t.id) ?? null,
        source: "api",
      })),
    ];

    // Only add fallback config templates if we are fetching 'all' folders
    if (!folderId || folderId === 'all') {
      merged.push(
        ...configByKey
          .filter(([, val]) => !apiSet.has(val.id))
          .map(([key, val]) => ({
            id: val.id,
            title: key,
            configKey: key,
            source: "config",
          }))
      );
    }

    return res.json({ templates: merged, defaultFolderId: DOCUMENSO_FOLDER_ID });
  }

  // Fallback: config.js only
  const fallback = configByKey.map(([key, val]) => ({
    id: val.id,
    title: key,
    configKey: key,
    source: "config",
  }));
  res.json({ templates: fallback, defaultFolderId: DOCUMENSO_FOLDER_ID });
});

/**
 * GET /api/folders
 *
 * Returns available Documenso folders.
 * Always includes the config.js default as a first option.
 *
 * Response shape:
 *   { folders: [{ id, name, isDefault? }], defaultFolderId }
 */
app.get("/api/folders", async (_req, res) => {
  const configDefault = {
    id: DOCUMENSO_FOLDER_ID,
    name: "Default (from config)",
    isDefault: true,
  };

  const apiFolders = await fetchAllDocumensoFolders();

  if (apiFolders.length > 0) {
    // Ensure config default is in the list (mark it if found)
    const hasDefault = apiFolders.some((f) => f.id === DOCUMENSO_FOLDER_ID);
    const folders = hasDefault
      ? apiFolders.map((f) => ({
          ...f,
          isDefault: f.id === DOCUMENSO_FOLDER_ID,
        }))
      : [configDefault, ...apiFolders];

    return res.json({ folders, defaultFolderId: DOCUMENSO_FOLDER_ID });
  }

  // Fallback: config default only
  res.json({ folders: [configDefault], defaultFolderId: DOCUMENSO_FOLDER_ID });
});

/**
 * POST /api/merge
 *
 * Body:
 * {
 *   combinations: [{
 *     title: string,
 *     templateIds: number[],   // Documenso template IDs in merge order
 *     folderId?: string|null   // null = use DOCUMENSO_FOLDER_ID from config
 *   }]
 * }
 *
 * Streams progress via Server-Sent Events (SSE).
 * The browser reads with fetch + ReadableStream (not EventSource — POST not supported).
 */
app.post("/api/merge", async (req, res) => {
  const { combinations } = req.body ?? {};

  if (!Array.isArray(combinations) || combinations.length === 0) {
    return res.status(400).json({ error: "No combinations provided" });
  }

  for (const combo of combinations) {
    if (!Array.isArray(combo.templateIds) || combo.templateIds.length === 0) {
      return res.status(400).json({ error: `Combination "${combo.title}" has no templateIds` });
    }
  }

  // ── Set up SSE ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === "function") res.flush();
  };

  send({ type: "start", total: combinations.length });

  try {
    // ── Phase 1: Fetch + download all unique template IDs ─────────────────
    const uniqueIds = [...new Set(combinations.flatMap((c) => c.templateIds))];
    const templateCache = {}; // id → { template, pdfBuffer } | null

    send({ type: "phase", message: "Fetching templates & downloading PDFs…" });

    for (const id of uniqueIds) {
      try {
        send({ type: "template-fetch", id, message: `Fetching template #${id}…` });
        const template = await fetchDocumensoTemplate(id);

        send({ type: "template-fetch", id, message: `Downloading PDF for #${id} "${template.title}"…` });
        const pdfBuffer = await downloadPDFBuffer(template);

        templateCache[id] = { template, pdfBuffer };
        send({ type: "template-ready", id, title: template.title });
      } catch (err) {
        send({ type: "template-error", id, error: err.message });
        templateCache[id] = null; // mark as failed
      }
    }

    // ── Phase 2: Create each combination ─────────────────────────────────
    send({ type: "phase", message: "Creating merged templates in Documenso…" });

    const results = [];

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      send({ type: "combo-start", index: i, title: combo.title });

      const failedIds = combo.templateIds.filter((id) => !templateCache[id]);
      if (failedIds.length > 0) {
        const error = `Template(s) failed to download: ${failedIds.join(", ")}`;
        send({ type: "combo-error", index: i, title: combo.title, error });
        results.push({ title: combo.title, status: "error", error });
        continue;
      }

      try {
        let runningOffset = 0;
        const templateEntries = [];

        for (const id of combo.templateIds) {
          const { template, pdfBuffer } = templateCache[id];
          const pageCount = await getPageCount(pdfBuffer);
          templateEntries.push({ template, pdfBuffer, pageOffset: runningOffset });
          send({
            type: "combo-progress",
            index: i,
            message: `#${id} "${template.title}" — ${pageCount} page(s), offset +${runningOffset}`,
          });
          runningOffset += pageCount;
        }

        send({ type: "combo-progress", index: i, message: "Merging PDFs with pdf-lib…" });
        const mergedBuffer = await mergePDFBuffers(templateEntries.map((e) => e.pdfBuffer));

        send({ type: "combo-progress", index: i, message: "Uploading to Documenso…" });
        const result = await createDocumensoTemplate(
          templateEntries,
          mergedBuffer,
          combo.title,
          combo.folderId ?? null
        );

        send({ type: "combo-done", index: i, title: combo.title, envelopeId: result.id, status: "ok" });
        results.push({ title: combo.title, status: "ok", envelopeId: result.id });
      } catch (err) {
        send({ type: "combo-error", index: i, title: combo.title, error: err.message });
        results.push({ title: combo.title, status: "error", error: err.message });
      }
    }

    send({ type: "done", results });
  } catch (err) {
    send({ type: "fatal", error: err.message });
  }

  res.end();
});

// ── Catch-all: serve React SPA ─────────────────────────────────────────────
app.get("*", (_req, res) => {
  const indexPath = path.join(clientDist, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: "PDF Merge API is running.",
      hint: "Build the frontend first: cd client && npm install && npm run build",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅  PDF Merge Web running → http://localhost:${PORT}`);
});
