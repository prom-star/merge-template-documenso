/**
 * create_combined_templates.js
 *
 * Engine script — never edit this file.
 * All configuration lives in config.js.
 *
 * For each combination defined in config.js:
 *   1. Fetches template fields + recipients from Documenso API
 *   2. Downloads each template PDF from Supabase private storage
 *   3. Merges PDFs using pdftk (preserves AcroForm fields)
 *   4. Calculates page offsets so field positions stay correct
 *   5. Creates a new combined Documenso template via API
 *
 * Usage:
 *   node create_combined_templates.js
 *
 * Requirements:
 *   npm install node-fetch form-data pdf-lib
 *   brew install pdftk-java
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { PDFDocument } from "pdf-lib";
import fetch from "node-fetch";
import FormData from "form-data";

import {
  DOCUMENSO_API_TOKEN,
  DOCUMENSO_BASE_URL,
  DOCUMENSO_FOLDER_ID,
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_BUCKET,
  TEMPLATES,
  COMBINATIONS,
} from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR   = path.join(__dirname, "tmp_merged");

// ─────────────────────────────────────────────
// Documenso — fetch template (fields + recipients + S3 path)
// ─────────────────────────────────────────────
async function fetchTemplate(templateId) {
  const res = await fetch(`${DOCUMENSO_BASE_URL}/template/${templateId}`, {
    headers: { Authorization: `Bearer ${DOCUMENSO_API_TOKEN}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch template ${templateId}: ${res.status} ${err}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────
// Supabase — download PDF via signed URL
//
// template.templateDocumentData.data contains the S3 path, e.g.:
//   "cr7vb8j2pt9f/level-2-progress-claim-jul-2023.pdf"
// This is used directly as the Supabase storage object path.
// ─────────────────────────────────────────────
async function downloadPDF(template, destPath) {
  const s3Path = template.templateDocumentData?.data;
  if (!s3Path) {
    throw new Error(`Template ${template.id} has no templateDocumentData.data`);
  }

  console.log(`    S3 path: ${s3Path}`);

  // Request a signed URL (valid 60s — enough to download)
  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${s3Path}`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 }),
    }
  );

  if (!signRes.ok) {
    const err = await signRes.text();
    throw new Error(
      `Supabase sign failed for "${s3Path}": ${signRes.status} ${err}\n` +
      `Check: SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET in config.js`
    );
  }

  const { signedURL } = await signRes.json();
  if (!signedURL) {
    throw new Error(`Supabase returned no signedURL for "${s3Path}"`);
  }

  // Download the PDF using the signed URL
  // signedURL is relative e.g. /object/sign/bucket/... needs /storage/v1 prepended
  const fullURL = `${SUPABASE_URL}/storage/v1${signedURL}`;
  const pdfRes = await fetch(fullURL);
  if (!pdfRes.ok) {
    throw new Error(`PDF download failed: ${pdfRes.status} ${pdfRes.statusText}`);
  }

  const buffer = await pdfRes.buffer();
  fs.writeFileSync(destPath, buffer);
  console.log(`    Saved ${path.basename(destPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ─────────────────────────────────────────────
// Get page count from a local PDF
// ─────────────────────────────────────────────
async function getPageCount(pdfPath) {
  const bytes = fs.readFileSync(pdfPath);
  const doc   = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

// ─────────────────────────────────────────────
// Merge PDFs using pdftk → single output file
// (preserves AcroForm fields unlike pdf-lib copyPages)
// ─────────────────────────────────────────────
function mergePDFs(inputPaths, outputPath) {
  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return;
  }
  const inputs = inputPaths.map((p) => `"${p}"`).join(" ");
  try {
    execSync(`pdftk ${inputs} cat output "${outputPath}"`, { stdio: "pipe" });
  } catch (e) {
    throw new Error(
      `pdftk merge failed: ${e.message}\n` +
      `Make sure pdftk is installed: brew install pdftk-java`
    );
  }
}

// ─────────────────────────────────────────────
// Build Documenso envelope payload
// All fields use identifier: 0 (single merged PDF)
// Page numbers are offset by pages preceding each template
// ─────────────────────────────────────────────
function buildPayload(templateEntries, title) {
  const recipientMap = new Map();
  let nextSigningOrder = 1;

  for (const { template, pageOffset } of templateEntries) {
    // Map recipientId → display name for this template
    const recipientRoleMap = new Map();
    for (const r of template.recipients ?? []) {
      const roleName = r.name?.trim() || r.role || `Signer ${r.signingOrder}`;
      recipientRoleMap.set(r.id, roleName);
    }

    for (const field of template.fields ?? []) {
      const roleName = recipientRoleMap.get(field.recipientId) ?? "Signer 1";

      if (!recipientMap.has(roleName)) {
        recipientMap.set(roleName, {
          name:         roleName,
          email:        "",        // filled at send time
          role:         "SIGNER",
          signingOrder: nextSigningOrder++,
          fields:       [],
        });
      }

      recipientMap.get(roleName).fields.push({
        identifier: 0,                               // single merged PDF
        type:       field.type,
        page:       Number(field.page) + pageOffset, // shift by preceding pages
        positionX:  parseFloat(field.positionX),
        positionY:  parseFloat(field.positionY),
        width:      parseFloat(field.width),
        height:     parseFloat(field.height),
        ...(field.fieldMeta ? { fieldMeta: field.fieldMeta } : {}),
      });
    }
  }

  return {
    type:     "TEMPLATE",
    title,
    folderId: DOCUMENSO_FOLDER_ID,
    meta: {
      timezone:               "Asia/Makassar",
      dateFormat:             "dd/MM/yyyy",
      signingOrder:           "SEQUENTIAL",
      language:               "en",
      typedSignatureEnabled:  true,
      uploadSignatureEnabled: true,
      drawSignatureEnabled:   true,
    },
    recipients: Array.from(recipientMap.values()),
  };
}

// ─────────────────────────────────────────────
// Create Documenso template via API
// ─────────────────────────────────────────────
async function createDocumensoTemplate(templateEntries, mergedPdfPath, title) {
  const payload = buildPayload(templateEntries, title);
  const form    = new FormData();

  form.append("payload", JSON.stringify(payload));
  form.append("files", fs.createReadStream(mergedPdfPath), {
    filename:    path.basename(mergedPdfPath),
    contentType: "application/pdf",
  });

  const res = await fetch(`${DOCUMENSO_BASE_URL}/envelope/create`, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${DOCUMENSO_API_TOKEN}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const responseText = await res.text();
  if (!res.ok) throw new Error(`API error ${res.status}: ${responseText}`);

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Could not parse API response: ${responseText}`);
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  // ── Step 1: Fetch all templates + download PDFs ──────────────────────────
  console.log("\n── Fetching templates + downloading PDFs ──");
  const templateCache = {};

  for (const [key, config] of Object.entries(TEMPLATES)) {
    console.log(`\n  [${key}] template ID: ${config.id}`);

    // Fetch template metadata from Documenso
    const template = await fetchTemplate(config.id);
    console.log(`    ✅ "${template.title}" — ${template.fields?.length ?? 0} fields`);

    // Download PDF from Supabase using the S3 path in the template response
    const pdfPath = path.join(TMP_DIR, `${key}.pdf`);
    await downloadPDF(template, pdfPath);

    templateCache[key] = { template, pdfPath };
  }

  // ── Step 2: Create each combination ─────────────────────────────────────
  console.log("\n── Creating combined templates ──");
  const results = [];

  for (const combo of COMBINATIONS) {
    console.log(`\n▶ ${combo.title}`);

    // Validate all keys exist
    const missingKeys = combo.keys.filter((k) => !templateCache[k]);
    if (missingKeys.length > 0) {
      const msg = `Missing template keys in config: ${missingKeys.join(", ")}`;
      console.error(`  ❌ Skipped — ${msg}`);
      results.push({ title: combo.title, status: "error", error: msg });
      continue;
    }

    // Calculate page offsets
    let runningPageOffset = 0;
    const templateEntries = [];

    for (const key of combo.keys) {
      const { template, pdfPath } = templateCache[key];
      const pageCount = await getPageCount(pdfPath);

      templateEntries.push({ template, pdfPath, pageOffset: runningPageOffset });
      console.log(`  [${key}] ${pageCount} page(s), offset +${runningPageOffset}`);
      runningPageOffset += pageCount;
    }

    // Merge PDFs
    const mergedPath = path.join(TMP_DIR, `${combo.keys.join("-")}-merged.pdf`);
    mergePDFs(templateEntries.map((e) => e.pdfPath), mergedPath);
    console.log(`  Merged → ${path.basename(mergedPath)} (${runningPageOffset} pages total)`);

    // Create Documenso template
    try {
      const result = await createDocumensoTemplate(templateEntries, mergedPath, combo.title);
      console.log(`  ✅ Created — Envelope ID: ${result.id}`);
      results.push({ title: combo.title, envelopeId: result.id, status: "ok" });
    } catch (err) {
      console.error(`  ❌ Failed — ${err.message}`);
      results.push({ title: combo.title, status: "error", error: err.message });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n── Summary ──────────────────────────────────────────────");
  for (const r of results) {
    const icon = r.status === "ok" ? "✅" : "❌";
    const info = r.status === "ok" ? `Envelope ID: ${r.envelopeId}` : r.error;
    console.log(`  ${icon} ${r.title}`);
    console.log(`     ${info}`);
  }

  const summaryPath = path.join(__dirname, "combined_templates_result.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: combined_templates_result.json`);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});