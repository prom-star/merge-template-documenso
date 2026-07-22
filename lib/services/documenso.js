import fetch from "node-fetch";
import FormData from "form-data";
import {
  DOCUMENSO_API_TOKEN,
  DOCUMENSO_BASE_URL,
  DOCUMENSO_FOLDER_ID,
  DEV_DOCUMENSO_API_TOKEN,
  DEV_DOCUMENSO_BASE_URL,
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_BUCKET,
} from "../../config.js";

export function getEnvConfig(env) {
  if (env === "dev") {
    return { baseUrl: DEV_DOCUMENSO_BASE_URL, token: DEV_DOCUMENSO_API_TOKEN };
  }
  return { baseUrl: DOCUMENSO_BASE_URL, token: DOCUMENSO_API_TOKEN };
}

export function envFetch(env, path, options = {}) {
  const config = getEnvConfig(env);
  if (!config.baseUrl || !config.token) {
    throw new Error(`Missing environment config for env: ${env}`);
  }
  return fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function fetchAllDocumensoTemplates(folderId) {
  const all = [];
  let page = 1;
  const perPage = 50;
  const maxPages = 20;

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
      const items = data.templates ?? data.data ?? [];
      all.push(...items);

      if (items.length < perPage) break;
      page++;
    }
  } catch (err) {
    console.warn("[/api/templates] Documenso API fetch failed:", err.message);
  }

  return all;
}

export async function fetchAllDocumensoFolders() {
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
  
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchDocumensoTemplate(templateId) {
  const res = await fetch(`${DOCUMENSO_BASE_URL}/template/${templateId}`, {
    headers: { Authorization: `Bearer ${DOCUMENSO_API_TOKEN}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Documenso fetch failed for template ${templateId}: ${res.status} ${err}`);
  }
  return res.json();
}

export async function downloadPDFBuffer(template) {
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

export function buildPayload(templateEntries, title, folderId) {
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

export async function createDocumensoTemplate(templateEntries, mergedPdfBuffer, title, folderId) {
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
