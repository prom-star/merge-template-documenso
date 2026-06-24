/**
 * config.js
 *
 * All configuration lives here.
 * The engine script (create_combined_templates.js) never needs to be edited.
 *
 * To add a new document in the future:
 *   1. Add its template entry to TEMPLATES
 *   2. Add new combinations to COMBINATIONS
 *   3. Run: node create_combined_templates.js
 */

import "dotenv/config";

// ─────────────────────────────────────────────
// Documenso
// ─────────────────────────────────────────────
export const DOCUMENSO_API_TOKEN = process.env.DOCUMENSO_API_TOKEN;
export const DOCUMENSO_BASE_URL  = process.env.DOCUMENSO_BASE_URL;
export const DOCUMENSO_FOLDER_ID = process.env.DOCUMENSO_FOLDER_ID;

// ─────────────────────────────────────────────
// Supabase Storage
//
// SUPABASE_URL      → Project URL from: Supabase Dashboard → Settings → API
// SUPABASE_KEY      → service_role key (not anon key) from same page
// SUPABASE_BUCKET   → bucket name from: Supabase Dashboard → Storage
//
// The PDF path is read automatically from each template's
// templateDocumentData.data field — no need to specify it here.
// ─────────────────────────────────────────────
export const SUPABASE_URL    = process.env.SUPABASE_URL;
export const SUPABASE_KEY    = process.env.SUPABASE_KEY;
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

// ─────────────────────────────────────────────
// Templates
//
// id      → Documenso template ID
//           (visible in Documenso UI URL or from GET /api/v2/template/{id})
//
// The PDF is downloaded automatically from Supabase using the S3 path
// stored inside the template — no pdfFile needed here anymore.
//
// To add a new template: just add a new entry below.
// ─────────────────────────────────────────────
export const TEMPLATES = {
  qbcc: {
    id: 51,
  },
  adhDeposit: {
    id: 54,
  },
  cashSettlementClient: {
    id: 53,
  },
  cashSettlementADS: {
    id: 52,
  },
  variation_level_1: {
    id: 59,
  },
  release_to_client: {
    id: 65,
  },
  release_to_builder: {
    id: 66,
  },
  release_to_client_builder: {
    id: 67,
  },
};

// ─────────────────────────────────────────────
// Combinations
//
// title → name of the combined template created in Documenso
// keys  → ordered list of TEMPLATES keys to merge (first = first PDF)
//
// To add a new combination: just add a new entry below.
// To add a new document variation: add to TEMPLATES above, then add
// whatever combinations you need here.
// ─────────────────────────────────────────────
export const COMBINATIONS = [
//   {
//     title: "QBCC Level 1 and Consumer Guide - ADS Deposit (Okt 2023)",
//     keys:  ["qbcc", "adhDeposit"],
//   },
//   {
//     title: "QBCC Level 1 and Consumer Guide - CS Client (Juli 2023)",
//     keys:  ["qbcc", "cashSettlementClient"],
//   },
//   {
//     title: "QBCC Level 1 and Consumer Guide - CS Security (Okt 2023)",
//     keys:  ["qbcc", "cashSettlementADS"],
//   },
//   {
//     title: "QBCC Level 1 and Consumer Guide - CS Client - ADS Deposit (Okt 2023)",
//     keys:  ["qbcc", "cashSettlementClient", "adhDeposit"],
//   },
//   {
//     title: "QBCC Level 1 and Consumer Guide - CS Security - AD Deposit (Okt 2023)",
//     keys:  ["qbcc", "cashSettlementADS", "adhDeposit"],
//   },
//   {
//     title: "QBCC Level 1 Variation - AD Deposit (Okt 2023)",
//     keys:  ["variation", "adhDeposit"],
//   },
    {
        title: "Var Level 1 - Release to Client Only",
        keys: ["variation_level_1", "release_to_client"],
    },
    {
        title: "Var Level 1 - Release to Builder Only",
        keys: ["variation_level_1", "release_to_builder"],
    },
    {
        title: "Var Level 1 - Release to Client and Builder",
        keys: ["variation_level_1", "release_to_client_builder"],
    },
];