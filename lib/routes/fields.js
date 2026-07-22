import express from "express";
import { envFetch } from "../services/documenso.js";

const router = express.Router();

/**
 * GET /api/update-fields/bulk-fields?ids=1,2,3&env=dev
 * Fetches fields for multiple templates.
 */
router.get("/bulk-fields", async (req, res) => {
  const { ids, env } = req.query;
  if (!ids) return res.json({ fields: [], types: [] });

  const templateIds = ids.split(",").map(Number).filter(Boolean);
  const allFields = [];
  const typeSet = new Set();

  try {
    for (const id of templateIds) {
      const r = await envFetch(env, `/template/${id}`);
      if (!r.ok) continue; // skip failed templates
      const data = await r.json();
      const fields = data.fields ?? [];
      for (const f of fields) {
        allFields.push({
          templateId: id,
          id: f.id,
          type: f.type,
          page: f.page,
          positionX: parseFloat(f.positionX),
          positionY: parseFloat(f.positionY),
          width: parseFloat(f.width),
          height: parseFloat(f.height),
          label: f.fieldMeta?.label || "",
        });
        typeSet.add(f.type);
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  res.json({
    fields: allFields,
    types: Array.from(typeSet).sort(),
  });
});

/**
 * POST /api/update-fields/bulk-square-fields
 * Bulk update fields so width == height (squares them up, adjusting X to keep center).
 * Body: { templateIds: [1,2], fieldType: "CHECKBOX", env: "dev" }
 */
router.post("/bulk-square-fields", async (req, res) => {
  const { templateIds = [], fieldType = "CHECKBOX", env = "prod" } = req.body;
  const results = { updated: [], skipped: 0, errors: [] };

  try {
    for (const templateId of templateIds) {
      // 1. Fetch current template fields
      const r = await envFetch(env, `/template/${templateId}`);
      if (!r.ok) {
        results.errors.push(`Template ${templateId} fetch failed: ${r.status}`);
        continue;
      }
      const data = await r.json();
      const allFields = data.fields ?? [];

      // 2. Filter
      const toUpdate = allFields
        .filter((f) => f.type === fieldType)
        .filter((f) => Math.abs(parseFloat(f.width) - parseFloat(f.height)) > 0.001);

      results.skipped += (allFields.filter((f) => f.type === fieldType).length - toUpdate.length);

      if (toUpdate.length === 0) continue;

      // 3. Build payload
      const updatePayload = {
        templateId,
        fields: toUpdate.map((f) => {
          const oldW = parseFloat(f.width);
          const oldH = parseFloat(f.height);
          const oldX = parseFloat(f.positionX);
          const oldY = parseFloat(f.positionY);
          const newX = oldX + (oldW - oldH) / 4;

          return {
            id: f.id,
            type: f.type,
            width: oldH,
            height: oldH,
            pageX: newX,
            pageY: oldY,
          };
        }),
      };

      // 4. Update
      const updateRes = await envFetch(env, `/template/field/update-many`, {
        method: "POST",
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        results.errors.push(`Template ${templateId} update failed: ${updateRes.status}`);
        continue;
      }

      const summary = updatePayload.fields.map((f) => {
        const orig = toUpdate.find(x => x.id === f.id);
        return {
          id: f.id,
          label: orig?.fieldMeta?.label || String(f.id),
          oldWidth: parseFloat(orig.width),
          newWidth: f.width,
        };
      });

      results.updated.push({
        templateId,
        title: data.title ?? `Template ${templateId}`,
        count: updatePayload.fields.length,
        fields: summary,
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
