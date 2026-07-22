import express from "express";
import { SIGNNOW_ROOT_FOLDER_ID } from "../../config.js";
import { signnowFetch, parseSignNowFolder } from "../services/signnow.js";
import { stampAcroForm, createDocumensoFromSignNow } from "../utils/pdf.js";
import { startSSE } from "../utils/sse.js";

const router = express.Router();

/**
 * GET /api/signnow/folders
 * Returns root template folder contents (subfolders + documents).
 */
router.get("/folders", async (_req, res) => {
  if (!SIGNNOW_ROOT_FOLDER_ID) {
    return res.status(400).json({ error: "SIGNNOW_ROOT_FOLDER_ID not set in .env" });
  }
  try {
    const r = await signnowFetch(
      `/folder/${SIGNNOW_ROOT_FOLDER_ID}?include_documents_subfolders=1`
    );
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `SignNow API: ${r.status} ${err}` });
    }
    const data = await r.json();
    res.json(parseSignNowFolder(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/signnow/folder/:id
 * Expand a specific subfolder.
 */
router.get("/folder/:id", async (req, res) => {
  try {
    const r = await signnowFetch(
      `/folder/${req.params.id}?include_documents_subfolders=1`
    );
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `SignNow API: ${r.status} ${err}` });
    }
    const data = await r.json();
    res.json(parseSignNowFolder(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/signnow/document/:id
 * Returns preview info: roles, field counts by type, page count.
 */
router.get("/document/:id", async (req, res) => {
  try {
    const r = await signnowFetch(`/document/${req.params.id}`);
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `SignNow API: ${r.status} ${err}` });
    }
    const doc = await r.json();

    const roles = (doc.roles ?? []).map((role) => ({
      name: role.name,
      signingOrder: role.signing_order,
    }));

    // Count fields by type
    const fieldCounts = {};
    for (const f of doc.fields ?? []) {
      const t = f.type ?? "unknown";
      fieldCounts[t] = (fieldCounts[t] ?? 0) + 1;
    }

    res.json({
      id: doc.id,
      name: doc.document_name ?? `Document ${doc.id}`,
      pageCount: (doc.pages ?? []).length || doc.page_count || 0,
      roles,
      fieldCounts,
      totalFields: (doc.fields ?? []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/signnow/migrate
 * Body: { documentId, templateTitle, env: "dev"|"prod", folderId? }
 * Streams SSE progress events.
 */
router.post("/migrate", async (req, res) => {
  const { documentId, templateTitle, env = "prod", folderId } = req.body ?? {};

  if (!documentId) return res.status(400).json({ error: "documentId is required" });
  if (!templateTitle?.trim()) return res.status(400).json({ error: "templateTitle is required" });

  const send = startSSE(res);

  try {
    // Step 1: Fetch document metadata
    send({ type: "progress", step: 1, message: "Fetching SignNow document metadata…" });
    const metaRes = await signnowFetch(`/document/${documentId}`);
    if (!metaRes.ok) {
      const err = await metaRes.text();
      return send({ type: "error", message: `Failed to fetch document: ${metaRes.status} ${err}` });
    }
    const doc = await metaRes.json();
    send({ type: "progress", step: 1, message: `Got document "${doc.document_name}" (${(doc.fields ?? []).length} fields, ${(doc.roles ?? []).length} roles)` });

    // Step 2: Download PDF
    send({ type: "progress", step: 2, message: "Downloading PDF from SignNow…" });
    const pdfRes = await signnowFetch(`/document/${documentId}/download?type=collapsed`);
    if (!pdfRes.ok) {
      const err = await pdfRes.text();
      return send({ type: "error", message: `PDF download failed: ${pdfRes.status} ${err}` });
    }
    const pdfArrayBuffer = await pdfRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    send({ type: "progress", step: 2, message: `Downloaded PDF (${Math.round(pdfBuffer.length / 1024)} KB)` });

    // Step 3: Stamp AcroForm fields
    send({ type: "progress", step: 3, message: "Stamping AcroForm fields onto PDF…" });
    const { pdfBytes, fieldsMetadata } = await stampAcroForm(pdfBuffer, doc);
    send({ type: "progress", step: 3, message: `Stamped ${fieldsMetadata.length} fields successfully` });

    // Step 4: Upload to Documenso
    const roles = (doc.roles ?? []).map((r) => ({ name: r.name, signing_order: Number(r.signing_order) || 0 }));
    send({ type: "progress", step: 4, message: `Uploading to Documenso (${env})…` });
    const result = await createDocumensoFromSignNow(pdfBytes, fieldsMetadata, roles, templateTitle, env, folderId);
    send({ type: "done", envelopeId: result.id, title: result.title ?? templateTitle, env });
  } catch (err) {
    send({ type: "error", message: err.message });
  }

  res.end();
});

export default router;
