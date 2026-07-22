import fetch from "node-fetch";
import { SIGNNOW_ACCESS_TOKEN } from "../../config.js";

const SIGNNOW_API = "https://api.signnow.com";

/** Fetch helper for SignNow API */
export function signnowFetch(path, options = {}) {
  if (!SIGNNOW_ACCESS_TOKEN) throw new Error("SIGNNOW_ACCESS_TOKEN not set in .env");
  return fetch(`${SIGNNOW_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SIGNNOW_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

/**
 * Parse a SignNow folder response into { folders, documents }.
 */
export function parseSignNowFolder(data) {
  const folders = (data.folders ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    totalDocuments: f.total_documents ?? 0,
    totalFolders: f.total_folders ?? 0,
  }));

  const documents = (data.documents ?? []).map((d) => ({
    id: d.id,
    name: d.document_name ?? d.name ?? `Document ${d.id}`,
    pageCount: d.page_count ?? 0,
    updated: d.updated ?? d.created ?? null,
  }));

  return { folders, documents };
}
