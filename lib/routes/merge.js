import express from "express";
import { startSSE } from "../utils/sse.js";
import { fetchDocumensoTemplate, downloadPDFBuffer, createDocumensoTemplate } from "../services/documenso.js";
import { getPageCount, mergePDFBuffers } from "../utils/pdf.js";

const router = express.Router();

/**
 * POST /api/start-process
 * Merges multiple Documenso templates into one.
 */
router.post("/start-process", async (req, res) => {
  const { templateIds, title, folderId } = req.body;
  if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
    return res.status(400).json({ error: "No templateIds provided" });
  }

  const send = startSSE(res);

  try {
    send({ type: "progress", step: 1, message: "Fetching template metadata..." });

    const templateEntries = [];
    let cumulativePageOffset = 0;
    const pdfBuffers = [];

    // Step 1: Fetch and prepare PDFs sequentially
    for (let i = 0; i < templateIds.length; i++) {
      const id = templateIds[i];
      send({ type: "progress", step: 1, message: `Fetching template ${i + 1}/${templateIds.length} (ID: ${id})` });

      const template = await fetchDocumensoTemplate(id);
      templateEntries.push({ template, pageOffset: cumulativePageOffset });

      send({ type: "progress", step: 2, message: `Downloading PDF for ${template.title ?? id}...` });
      const pdfBuffer = await downloadPDFBuffer(template);
      pdfBuffers.push(pdfBuffer);

      const pageCount = await getPageCount(pdfBuffer);
      cumulativePageOffset += pageCount;
    }

    // Step 3: Merge PDFs
    send({ type: "progress", step: 3, message: "Merging PDF documents..." });
    const mergedPdfBuffer = await mergePDFBuffers(pdfBuffers);
    send({ type: "progress", step: 3, message: `Merged ${pdfBuffers.length} PDFs into ${cumulativePageOffset} pages.` });

    // Step 4: Upload to Documenso
    send({ type: "progress", step: 4, message: "Uploading merged template to Documenso..." });
    const finalTemplateTitle = title || `Merged Template - ${new Date().toISOString()}`;
    const result = await createDocumensoTemplate(templateEntries, mergedPdfBuffer, finalTemplateTitle, folderId);

    send({
      type: "done",
      envelopeId: result.id,
      title: result.title,
    });
  } catch (error) {
    console.error("Process error:", error);
    send({ type: "error", message: error.message || "An unknown error occurred" });
  }

  res.end();
});

export default router;
