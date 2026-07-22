import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFRef, PDFHexString, rgb, TextAlignment } from "pdf-lib";
import fetch from "node-fetch";
import FormData from "form-data";
import { getEnvConfig } from "../services/documenso.js";

/**
 * Merge an array of PDF buffers into one using pdf-lib.
 * Returns a Buffer.
 */
export async function mergePDFBuffers(pdfBuffers) {
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
export async function getPageCount(pdfBuffer) {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return doc.getPageCount();
}

function buildValidatorLookupSN(doc) {
  const byId = {};
  for (const v of doc.field_validators ?? []) {
    if (!byId[v.id]) byId[v.id] = v;
  }
  return byId;
}

function resolveSignNowType(field, attrs, validatorsById) {
  switch (field.type) {
    case "signature": return "SIGNATURE";
    case "enumeration": return "DROPDOWN";
    case "checkbox": return "CHECKBOX";
    case "radiobutton": return "RADIO";
    case "text": {
      const v = attrs.validator_id ? validatorsById[attrs.validator_id] : null;
      const label = (
        v?.display_json_attributes?.web_short_name || v?.name || v?.description || ""
      ).toLowerCase();
      return label.includes("date") ? "DATE" : "TEXT";
    }
    default: return "TEXT";
  }
}

function toPdfRectSN(x, y, w, h, pageHeight) {
  const x0 = x, y1 = pageHeight - y, y0 = y1 - h, x1 = x + w;
  return [x0, y0, x1, y1];
}

function addSigWidget(pdfDoc, page, rect, fieldName, tooltip) {
  const ctx = pdfDoc.context;
  const widget = ctx.obj({
    FT: "Sig", Type: "Annot", Subtype: "Widget",
    Rect: rect,
    T: PDFString.of(fieldName),
    F: 4,
    P: page.ref,
    Border: [0, 0, 0],
    ...(tooltip ? { TU: PDFString.of(tooltip) } : {}),
  });
  const ref = ctx.register(widget);
  let annots = page.node.Annots();
  if (!annots) {
    annots = ctx.obj([]);
    page.node.set(PDFName.of("Annots"), annots);
  }
  annots.push(ref);
  const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"));
  acroForm.lookup(PDFName.of("Fields")).push(ref);
}

export async function stampAcroForm(pdfBytes, doc) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont("Helvetica");

  const roles = {};
  for (const r of doc.roles ?? []) roles[r.unique_id] = r.name;

  const validatorsById = buildValidatorLookupSN(doc);

  const enumOptions = {};
  for (const opt of doc.enumeration_options ?? []) {
    if (!enumOptions[opt.enumeration_id]) enumOptions[opt.enumeration_id] = [];
    enumOptions[opt.enumeration_id].push(opt.data);
  }

  const fieldsMetadata = [];
  const seenNames = new Set();

  for (const field of doc.fields ?? []) {
    const attrs = field.json_attributes ?? {};
    const pageIndex = (attrs.page_number ?? 0);

    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();
    const rect = toPdfRectSN(attrs.x, attrs.y, attrs.width, attrs.height, pageHeight);
    const [x0, y0, x1, y1] = rect;
    const w = x1 - x0, h = y1 - y0;

    const roleName = roles[field.role_id] ?? "Unknown";
    let fieldName = attrs.name || field.id;
    const label = attrs.label || fieldName;
    const resolvedType = resolveSignNowType(field, attrs, validatorsById);

    // Deduplicate field names (AcroForm requires unique names)
    if (seenNames.has(fieldName)) {
      let n = 2;
      while (seenNames.has(`${fieldName}_${n}`)) n++;
      fieldName = `${fieldName}_${n}`;
    }
    seenNames.add(fieldName);

    try {
      if (field.type === "text") {
        const tf = form.createTextField(fieldName);
        if (attrs.required) tf.enableRequired();
        
        if (attrs.align === "center") tf.setAlignment(TextAlignment.Center);
        else if (attrs.align === "right") tf.setAlignment(TextAlignment.Right);
        else tf.setAlignment(TextAlignment.Left);

        tf.addToPage(page, { x: x0, y: y0, width: w, height: h, font: helv, textColor: rgb(0, 0, 0), borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
      } else if (field.type === "enumeration") {
        const opts = enumOptions[field.id] ?? [];
        const dd = form.createDropdown(fieldName);
        if (opts.length) dd.addOptions(opts);
        if (attrs.required) dd.enableRequired();
        dd.addToPage(page, { x: x0, y: y0, width: w, height: h, font: helv, borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
      } else if (field.type === "signature") {
        addSigWidget(pdfDoc, page, rect, fieldName, label);
      } else if (field.type === "checkbox") {
        const cb = form.createCheckBox(fieldName);
        if (attrs.required) cb.enableRequired();
        cb.addToPage(page, { x: x0, y: y0, width: w, height: h, borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
      } else if (field.type === "radiobutton") {
        const rg = form.createRadioGroup(fieldName);
        if (attrs.required) rg.enableRequired();
        rg.addOptionToPage(attrs.enumeration_option_value ?? "option", page, { x: x0, y: y0, width: w, height: h, borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
      } else {
        continue;
      }
    } catch (_) { continue; }

    fieldsMetadata.push({
      field_name: fieldName,
      label,
      role: roleName,
      resolved_type: resolvedType,
      options: field.type === "enumeration" ? (enumOptions[field.id] ?? []) : undefined,
      page_number: attrs.page_number ?? 0,
      required: !!attrs.required,
      align: attrs.align,
      valign: attrs.valign,
    });
  }

  return { pdfBytes: await pdfDoc.save(), fieldsMetadata };
}

function buildDocumensoFieldMeta(field) {
  const required = !!field.required;
  const textAlign = field.align === "center" ? "center" : field.align === "right" ? "right" : "left";
  const verticalAlign = field.valign === "top" ? "top" : field.valign === "bottom" ? "bottom" : "middle";

  switch (field.resolved_type) {
    case "TEXT": return { label: field.field_name, placeholder: "", required, readOnly: false, fontSize: 10, type: "text", text: "", characterLimit: 0, textAlign, lineHeight: 1, letterSpacing: 0, verticalAlign };
    case "DATE": return { label: field.field_name, required, readOnly: false, fontSize: 10, overflow: "auto", type: "date", value: "", textAlign };
    case "SIGNATURE": return { fontSize: 18, overflow: "auto", type: "signature" };
    case "CHECKBOX": return { label: field.field_name, required, readOnly: false, fontSize: 12, type: "checkbox", values: [{ id: 1, checked: false, value: "" }], validationRule: "", validationLength: 0, direction: "vertical" };
    case "RADIO": return { label: field.field_name, required, readOnly: false, fontSize: 12, type: "radio", values: [{ id: 1, checked: false, value: "" }], direction: "vertical" };
    case "DROPDOWN": {
      const opts = (field.options?.length ? field.options : ["Option 1"]).map((v) => ({ value: v }));
      return { label: field.field_name, required, readOnly: false, fontSize: 10, type: "dropdown", values: opts, defaultValue: "" };
    }
    default: return { label: field.field_name, placeholder: "", required, readOnly: false, fontSize: 10, type: "text", text: "", characterLimit: 0, textAlign: "left", lineHeight: 1, letterSpacing: 0, verticalAlign: "middle" };
  }
}

export async function createDocumensoFromSignNow(pdfBytes, fieldsMetadata, roles, title, env, folderId) {
  const { baseUrl, token } = getEnvConfig(env);

  // Build recipients from roles
  const orderedRoles = [...roles].sort((a, b) => (a.signing_order ?? 0) - (b.signing_order ?? 0));
  const fieldsByRole = new Map(orderedRoles.map((r) => [r.name, []]));

  // Extract AcroForm field positions from the stamped PDF
  const loadedPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = loadedPdf.getPages();
  const pageSizes = pages.map((p) => p.getSize());

  // Build ref→pageIndex map
  const pageRefMap = new Map();
  let pgCounter = 0;
  function walkTree(node) {
    let dict;
    if (node instanceof PDFRef) {
      try { dict = loadedPdf.context.lookup(node); } catch { return; }
      const t = dict?.get?.(PDFName.of("Type"))?.asString?.() ?? "";
      if (t === "/Page") { pageRefMap.set(node.toString(), pgCounter++); return; }
    } else { dict = node; }
    if (!dict?.get) return;
    const t = dict.get(PDFName.of("Type"))?.asString?.() ?? "";
    if (t === "/Page") { pgCounter++; return; }
    const kids = dict.get(PDFName.of("Kids"));
    const kidsArr = kids instanceof PDFArray ? kids
      : kids instanceof PDFRef ? (() => { try { return loadedPdf.context.lookup(kids); } catch { return null; } })() : null;
    if (!kidsArr) return;
    for (let i = 0; i < kidsArr.size(); i++) walkTree(kidsArr.get(i));
  }
  const pagesRef = loadedPdf.catalog.get(PDFName.of("Pages"));
  if (pagesRef) walkTree(pagesRef);

  function getStr(obj) {
    if (!obj) return "";
    try {
      if (obj instanceof PDFHexString) return obj.decodeText();
      if (obj instanceof PDFString) return obj.asString();
      if (typeof obj.decodeText === "function") return obj.decodeText();
      if (typeof obj.asString === "function") return obj.asString();
      return obj.toString().replace(/^[(<]|[>)]$/g, "");
    } catch { return ""; }
  }

  const acroForm = loadedPdf.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fieldsArr = acroForm?.lookupMaybe?.(PDFName.of("Fields"), PDFArray);

  const acroFields = {};
  function processAcroField(obj, parentName = "") {
    let fd = obj instanceof PDFDict ? obj : null;
    if (obj instanceof PDFRef) {
      try { fd = loadedPdf.context.lookupMaybe(obj, PDFDict); } catch { return; }
    }
    if (!fd) return;
    const part = getStr(fd.get(PDFName.of("T")));
    const full = part ? (parentName ? `${parentName}.${part}` : part) : parentName;
    const kidsRaw = fd.get(PDFName.of("Kids"));
    let kids = null;
    if (kidsRaw instanceof PDFArray) kids = kidsRaw;
    else if (kidsRaw instanceof PDFRef) { try { kids = loadedPdf.context.lookupMaybe(kidsRaw, PDFArray); } catch {} }
    if (kids) { for (let i = 0; i < kids.size(); i++) processAcroField(kids.get(i), full); return; }

    const rectObj = fd.lookupMaybe(PDFName.of("Rect"), PDFArray);
    if (!rectObj) return;
    const x1 = rectObj.get(0).asNumber(), y1 = rectObj.get(1).asNumber();
    const x2 = rectObj.get(2).asNumber(), y2 = rectObj.get(3).asNumber();
    let pgIdx = 0, pgW = pageSizes[0]?.width ?? 595, pgH = pageSizes[0]?.height ?? 842;
    const pRef = fd.get(PDFName.of("P"));
    if (pRef) { const idx = pageRefMap.get(pRef.toString()); if (idx !== undefined) { pgIdx = idx; pgW = pageSizes[idx].width; pgH = pageSizes[idx].height; } }
    const left = Math.min(x1, x2), bottom = Math.min(y1, y2), right = Math.max(x1, x2), top = Math.max(y1, y2);
    acroFields[full] = {
      page: pgIdx + 1,
      positionX: Math.round((left / pgW) * 10000) / 100,
      positionY: Math.round(((pgH - top) / pgH) * 10000) / 100,
      width: Math.round(((right - left) / pgW) * 10000) / 100,
      height: Math.round(((top - bottom) / pgH) * 10000) / 100,
    };
  }

  if (fieldsArr) for (let i = 0; i < fieldsArr.size(); i++) processAcroField(fieldsArr.get(i));

  // Assign fields to recipients
  for (const fm of fieldsMetadata) {
    const pos = acroFields[fm.field_name];
    if (!pos) continue;
    const roleName = fm.role && fieldsByRole.has(fm.role) ? fm.role : orderedRoles[0]?.name;
    if (!roleName) continue;
    fieldsByRole.get(roleName).push({
      identifier: 0,
      type: fm.resolved_type === "TEXT" ? "TEXT" :
            fm.resolved_type === "DATE" ? "DATE" :
            fm.resolved_type === "SIGNATURE" ? "SIGNATURE" :
            fm.resolved_type === "CHECKBOX" ? "CHECKBOX" :
            fm.resolved_type === "RADIO" ? "RADIO" :
            fm.resolved_type === "DROPDOWN" ? "DROPDOWN" : "TEXT",
      ...pos,
      fieldMeta: buildDocumensoFieldMeta(fm),
    });
  }

  const recipients = orderedRoles
    .map((r, i) => ({
      name: r.name,
      email: "",
      role: "SIGNER",
      signingOrder: r.signing_order ?? (i + 1),
      fields: fieldsByRole.get(r.name) ?? [],
    }))
    .filter((r) => r.fields.length > 0);

  const payload = {
    type: "TEMPLATE",
    title,
    ...(folderId ? { folderId } : {}),
    meta: {
      timezone: "Asia/Makassar",
      dateFormat: "dd/MM/yyyy",
      signingOrder: "SEQUENTIAL",
      language: "en",
      typedSignatureEnabled: true,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: true,
    },
    recipients,
  };

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("files", Buffer.from(pdfBytes), {
    filename: `${title}.pdf`,
    contentType: "application/pdf",
  });

  const res = await fetch(`${baseUrl}/envelope/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    body: form,
  });

  const responseText = await res.text();
  if (!res.ok) throw new Error(`Documenso API ${res.status}: ${responseText}`);
  return JSON.parse(responseText);
}
