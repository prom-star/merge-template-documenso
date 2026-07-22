import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Import Modular Routers
import documensoRoutes from "./lib/routes/documenso.js";
import fieldsRoutes from "./lib/routes/fields.js";
import mergeRoutes from "./lib/routes/merge.js";
import signnowRoutes from "./lib/routes/signnow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

// ─── Serve built React app in production ──────────────────────────────────
const clientDist = path.join(__dirname, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ─── API Routes ───────────────────────────────────────────────────────────
app.use("/api", documensoRoutes);
app.use("/api/update-fields", fieldsRoutes);
app.use("/api", mergeRoutes);
app.use("/api/signnow", signnowRoutes);

// Catch-all to serve index.html for React routing in production
if (fs.existsSync(clientDist)) {
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(clientDist, "index.html"));
    } else {
      res.status(404).json({ error: "API route not found" });
    }
  });
}

// ─── Start Server ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  PDF Merge Web running → http://localhost:${PORT}\n`);
});
