import express from "express";
import { TEMPLATES, DOCUMENSO_FOLDER_ID } from "../../config.js";
import {
  fetchAllDocumensoTemplates,
  fetchAllDocumensoFolders,
  envFetch
} from "../services/documenso.js";

const router = express.Router();

/**
 * GET /api/templates
 */
router.get("/templates", async (req, res) => {
  const { folderId, source } = req.query;
  const configByKey = Object.entries(TEMPLATES);
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

  const apiTemplates = await fetchAllDocumensoTemplates(folderId);

  if (apiTemplates.length > 0 || (folderId && folderId !== 'all')) {
    const apiSet = new Set(apiTemplates.map((t) => t.id));

    const merged = [
      ...apiTemplates.map((t) => ({
        id: t.id,
        title: t.title ?? `Template ${t.id}`,
        configKey: configById.get(t.id) ?? null,
        source: "api",
      })),
    ];

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
 */
router.get("/folders", async (_req, res) => {
  const configDefault = {
    id: DOCUMENSO_FOLDER_ID,
    name: "Default (from config)",
    isDefault: true,
  };

  const apiFolders = await fetchAllDocumensoFolders();

  if (apiFolders.length > 0) {
    const hasDefault = apiFolders.some((f) => f.id === DOCUMENSO_FOLDER_ID);
    const folders = hasDefault
      ? apiFolders.map((f) => ({
          ...f,
          isDefault: f.id === DOCUMENSO_FOLDER_ID,
        }))
      : [configDefault, ...apiFolders];

    return res.json({ folders, defaultFolderId: DOCUMENSO_FOLDER_ID });
  }

  res.json({ folders: [configDefault], defaultFolderId: DOCUMENSO_FOLDER_ID });
});

/**
 * GET /api/dev/folders
 */
router.get("/dev/folders", async (_req, res) => {
  const all = [];
  let page = 1;
  const perPage = 100;

  try {
    while (page <= 20) {
      const r = await envFetch("dev", `/folder?page=${page}&perPage=${perPage}`);
      if (!r.ok) break;
      const data = await r.json();
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
    return res.status(500).json({ error: err.message });
  }

  res.json({ folders: all.sort((a, b) => a.name.localeCompare(b.name)) });
});

/**
 * GET /api/dev/templates
 */
router.get("/dev/templates", async (req, res) => {
  const { folderId } = req.query;
  const all = [];
  let page = 1;
  const perPage = 50;

  try {
    while (page <= 20) {
      let url = `/template?page=${page}&perPage=${perPage}`;
      if (folderId && folderId !== 'all') {
        url += `&folderId=${folderId}`;
      }
      const r = await envFetch("dev", url);
      if (!r.ok) break;
      const data = await r.json();
      const items = data.templates ?? data.data ?? [];
      all.push(
        ...items.map((t) => ({
          id: t.id,
          title: t.title ?? `Template ${t.id}`,
          source: "api",
        }))
      );
      if (items.length < perPage) break;
      page++;
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  res.json({ templates: all, defaultFolderId: "" });
});

export default router;
