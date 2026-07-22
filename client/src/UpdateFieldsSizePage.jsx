import { useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  Loader2,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CheckSquare2,
  RefreshCw,
  ArrowRight,
  Database,
  Server,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function fmt(n) {
  return typeof n === "number" ? n.toFixed(4) : "—";
}

// ─────────────────────────────────────────────────────────────────────────
// DevCustomSelect — simple searchable dropdown
// ─────────────────────────────────────────────────────────────────────────
function DevCustomSelect({ options, value, onChange, placeholder, icon: Icon, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(q.toLowerCase()) ||
      String(o.value).toLowerCase().includes(q.toLowerCase())
  );
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const handle = (e) => {
      if (!e.target.closest("[data-dev-select]")) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="relative" data-dev-select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm text-left focus:outline-none focus:ring-2 transition-all shadow-sm bg-white border-slate-200 text-slate-700 focus:border-violet-400 focus:ring-violet-100 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {Icon && <Icon size={14} className="text-slate-400" />}
        </div>
        <span className="block truncate">
          {selected ? selected.label : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <ChevronRight
            size={13}
            className={`transition-transform text-slate-400 ${open ? "-rotate-90" : "rotate-90"}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 flex flex-col">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all placeholder-slate-400"
            />
          </div>
          <ul className="py-1 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-400 italic">No results</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`px-3 py-2 cursor-pointer hover:bg-violet-50 transition-colors ${o.value === value ? "bg-violet-50/50" : ""}`}
                >
                  <div className="text-sm font-medium text-slate-700">{o.label}</div>
                  {o.sub && <div className="text-[11px] text-slate-400 font-mono mt-0.5">{o.sub}</div>}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FieldPreviewTable — before/after dimensions for BULK updates (Grouped)
// ─────────────────────────────────────────────────────────────────────────
function FieldPreviewTable({ fields, selectedType, templates }) {
  const filtered = fields.filter((f) => f.type === selectedType);
  if (filtered.length === 0) {
    return (
      <p className="text-slate-400 text-sm italic text-center py-6">
        No <span className="font-mono">{selectedType}</span> fields found in the selected templates.
      </p>
    );
  }

  // Group fields by template ID
  const grouped = filtered.reduce((acc, f) => {
    if (!acc[f.templateId]) acc[f.templateId] = [];
    acc[f.templateId].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6 mt-4">
      {Object.entries(grouped).map(([templateIdStr, tFields]) => {
        const templateId = Number(templateIdStr);
        const template = templates.find((t) => t.id === templateId);
        const title = template ? template.title || template.name : `Template ${templateId}`;
        const needsUpdateCount = tFields.filter((f) => Math.abs(f.width - f.height) > 0.001).length;

        return (
          <div key={templateId} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Card Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
                <p className="text-xs font-mono text-slate-500 mt-0.5">ID: {templateId}</p>
              </div>
              <div className="text-xs font-semibold">
                {needsUpdateCount > 0 ? (
                  <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    {needsUpdateCount} to update
                  </span>
                ) : (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                    All square
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-500">Field ID</th>
                    <th className="px-4 py-2 font-semibold text-slate-500">Label</th>
                    <th className="px-4 py-2 font-semibold text-slate-500">Page</th>
                    <th className="px-4 py-2 font-semibold text-slate-500">Height</th>
                    <th className="px-4 py-2 font-semibold text-slate-500">Width (current)</th>
                    <th className="px-4 py-2 font-semibold text-slate-500"></th>
                    <th className="px-4 py-2 font-semibold text-violet-600">Width (after)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tFields.map((f, i) => {
                    const needsUpdate = Math.abs(f.width - f.height) > 0.001;
                    return (
                      <tr
                        key={f.id}
                        className={needsUpdate ? "bg-amber-50/20" : "bg-emerald-50/10"}
                      >
                        <td className="px-4 py-2 font-mono text-slate-600">{f.id}</td>
                        <td className="px-4 py-2 text-slate-700 font-medium">{f.label || <span className="text-slate-300 italic">No Label</span>}</td>
                        <td className="px-4 py-2 text-slate-500">{f.page}</td>
                        <td className="px-4 py-2 font-mono text-slate-700">{fmt(f.height)}</td>
                        <td className={`px-4 py-2 font-mono ${needsUpdate ? "text-amber-600 font-semibold" : "text-slate-600"}`}>
                          {fmt(f.width)}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {needsUpdate && <ArrowRight size={12} />}
                        </td>
                        <td className={`px-4 py-2 font-mono font-semibold ${needsUpdate ? "text-violet-600" : "text-slate-400"}`}>
                          {needsUpdate ? fmt(f.height) : fmt(f.width)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ResultPanel — shown after applying (Grouped)
// ─────────────────────────────────────────────────────────────────────────
function ResultPanel({ result, onReset, templates }) {
  const isError = !!result.error;
  
  // Group updated fields by template ID
  const groupedUpdated = (result.updated || []).reduce((acc, f) => {
    if (!acc[f.templateId]) acc[f.templateId] = [];
    acc[f.templateId].push(f);
    return acc;
  }, {});

  return (
    <div className={`rounded-xl border p-5 ${isError ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
      <div className="flex items-start gap-3">
        {isError
          ? <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          : <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`font-semibold text-sm ${isError ? "text-red-700" : "text-emerald-700"}`}>
            {isError ? "Update failed" : result.message}
          </p>
          {isError && (
            <p className="text-red-600 text-xs mt-1 font-mono break-all">{result.error}</p>
          )}
          {!isError && result.errors?.length > 0 && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
              <p className="font-semibold mb-1">Some templates failed:</p>
              <ul className="list-disc pl-4 space-y-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {!isError && result.updated?.length > 0 && (
            <div className="mt-4 space-y-4">
              {Object.entries(groupedUpdated).map(([templateIdStr, tFields]) => {
                const templateId = Number(templateIdStr);
                const template = templates.find((t) => t.id === templateId);
                const title = template ? template.title || template.name : `Template ${templateId}`;

                return (
                  <div key={templateId} className="border border-emerald-200 rounded-lg overflow-hidden bg-white">
                    <div className="bg-emerald-50/60 border-b border-emerald-100 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800">{title} (ID: {templateId})</span>
                      <span className="text-xs font-medium text-emerald-600 bg-white px-2 py-0.5 rounded border border-emerald-100">{tFields.length} updated</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-white border-b border-slate-50">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-slate-500">Field ID</th>
                            <th className="px-3 py-2 font-semibold text-slate-500">Label</th>
                            <th className="px-3 py-2 font-semibold text-slate-500">Page</th>
                            <th className="px-3 py-2 font-semibold text-slate-500">Width before</th>
                            <th className="px-3 py-2 font-semibold text-emerald-600">Width after</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {tFields.map((f, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 font-mono text-slate-600">{f.id}</td>
                              <td className="px-3 py-1.5 text-slate-700 font-medium">{f.label || <span className="text-slate-300 italic">No Label</span>}</td>
                              <td className="px-3 py-1.5 text-slate-500">{f.page}</td>
                              <td className="px-3 py-1.5 font-mono text-amber-600">{fmt(f.widthBefore)}</td>
                              <td className="px-3 py-1.5 font-mono font-semibold text-emerald-600">{fmt(f.widthAfter)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isError && result.skipped > 0 && (
            <p className="text-slate-500 text-xs mt-2">
              {result.skipped} field(s) were already square — skipped.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-violet-600 hover:text-violet-700 text-sm font-semibold bg-violet-50 hover:bg-violet-100 border border-violet-200 px-4 py-2 rounded-xl transition-all"
        >
          <RefreshCw size={13} /> Update More Templates
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// UpdateFieldsSizePage — main export
// ─────────────────────────────────────────────────────────────────────────
export default function UpdateFieldsSizePage() {
  const [env, setEnv] = useState("dev"); // "dev" or "prod"

  // Folder state
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState("all");

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);

  // Fields state
  const [fields, setFields] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState(null);
  const [selectedType, setSelectedType] = useState("CHECKBOX");

  // Apply state
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  // 1. Load folders when environment changes
  useEffect(() => {
    setFoldersLoading(true);
    setFoldersError(null);
    setSelectedFolderId("all");
    setSelectedTemplateIds([]);
    setTemplates([]);
    setFields([]);

    const endpoint = env === "dev" ? "/api/dev/folders" : "/api/folders";
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setFolders(d.folders ?? []);
      })
      .catch((e) => setFoldersError(e.message))
      .finally(() => setFoldersLoading(false));
  }, [env]);

  // 2. Load templates when folder/env changes
  useEffect(() => {
    setSelectedTemplateIds([]);
    setFields([]);
    setAvailableTypes([]);
    setResult(null);
    
    // Default config doesn't exist for dev, so just don't fetch if no folders loaded yet
    if (foldersLoading) return;

    setTemplatesLoading(true);
    let endpoint = env === "dev" ? "/api/dev/templates" : "/api/templates";
    if (selectedFolderId && selectedFolderId !== "all") {
      endpoint += `?folderId=${selectedFolderId}`;
    }

    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch((e) => console.error("templates fetch:", e))
      .finally(() => setTemplatesLoading(false));
  }, [selectedFolderId, env, foldersLoading]);

  // 3. Load fields when template selection changes
  useEffect(() => {
    if (selectedTemplateIds.length === 0) {
      setFields([]);
      setAvailableTypes([]);
      setResult(null);
      return;
    }

    setFields([]);
    setAvailableTypes([]);
    setResult(null);
    setFieldsLoading(true);
    setFieldsError(null);

    const idsQuery = selectedTemplateIds.join(",");
    fetch(`/api/update-fields/bulk-fields?ids=${idsQuery}&env=${env}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setFields(d.fields ?? []);
        const types = d.types ?? [];
        setAvailableTypes(types);
        if (types.includes("CHECKBOX")) setSelectedType("CHECKBOX");
        else if (types.length > 0) setSelectedType(types[0]);
      })
      .catch((e) => setFieldsError(e.message))
      .finally(() => setFieldsLoading(false));
  }, [selectedTemplateIds, env]);

  const toggleTemplateSelection = (id) => {
    setSelectedTemplateIds(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const selectAllTemplates = () => {
    setSelectedTemplateIds(templates.map(t => t.id));
  };

  const deselectAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

  const handleApply = async () => {
    if (selectedTemplateIds.length === 0) return;
    setApplying(true);
    setResult(null);
    try {
      const r = await fetch(`/api/update-fields/bulk-square-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          templateIds: selectedTemplateIds, 
          fieldType: selectedType, 
          env 
        }),
      });
      const d = await r.json();
      setResult(d);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setApplying(false);
    }
  };

  const resetResult = () => {
    setResult(null);
  };

  // --- Derived
  const fieldsOfType = fields.filter((f) => f.type === selectedType);
  const needsUpdateCount = fieldsOfType.filter(
    (f) => Math.abs(f.width - f.height) > 0.001
  ).length;

  const folderOptions = [
    { value: "all", label: "All Folders", sub: "Search everywhere" },
    ...folders.map((f) => ({ value: f.id, label: f.name, sub: `ID: ${f.id}` })),
  ];

  const typeOptions = availableTypes.map((tp) => ({
    value: tp,
    label: tp,
    sub: `${fields.filter((f) => f.type === tp).length} field(s)`,
  }));

  if (foldersLoading) {
    return (
      <div className="text-center py-24">
        <Loader2 size={36} className="text-violet-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Connecting to Documenso…</p>
      </div>
    );
  }

  if (foldersError) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm">
        <XCircle size={36} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-700 font-semibold mb-1">Failed to connect to API</p>
        <p className="text-slate-400 text-sm mb-2">{foldersError}</p>
        <p className="text-slate-300 text-xs">
          Check that the token and base URL for {env.toUpperCase()} are correctly set in <code className="text-slate-400">.env</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Env Toggle */}
      <div className="text-center mb-2">
        <div className="inline-flex bg-slate-100 p-1 rounded-full mb-4 shadow-inner">
          <button
            onClick={() => setEnv("prod")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              env === "prod"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Database size={13} className={env === "prod" ? "text-blue-500" : ""} />
            Production
          </button>
          <button
            onClick={() => setEnv("dev")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              env === "dev"
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Server size={13} className={env === "dev" ? "text-violet-500" : ""} />
            Development
          </button>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Update Fields Size</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Select templates from {env === "dev" ? "Development" : "Production"} to preview and square their field dimensions (width = height).
        </p>
      </div>

      {/* Step 1 — Pick folder + templates (Checklist style) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">
          Step 1 — Select Templates
        </p>
        <div className="mb-4 max-w-xs">
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
            Source Folder
          </label>
          <DevCustomSelect
            options={folderOptions}
            value={selectedFolderId}
            onChange={setSelectedFolderId}
            placeholder="All Folders"
            icon={FolderOpen}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
              Templates ({templates.length})
              {templatesLoading && <Loader2 size={11} className={`inline ml-1.5 animate-spin ${env === "dev" ? "text-violet-500" : "text-blue-500"}`} />}
            </label>
            <div className="text-xs text-slate-500">
              <button onClick={selectAllTemplates} className="hover:text-blue-600 font-medium">Select All</button>
              <span className="mx-2">•</span>
              <button onClick={deselectAllTemplates} className="hover:text-blue-600 font-medium">Deselect All</button>
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2">
            {templates.length === 0 && !templatesLoading && (
              <p className="text-center text-slate-400 text-sm py-4 italic">No templates found in this folder.</p>
            )}
            {templates.map(t => {
              const isSelected = selectedTemplateIds.includes(t.id);
              return (
                <label key={t.id} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-white border-slate-200 shadow-sm" : "hover:bg-slate-100 border border-transparent"} border mb-1`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTemplateSelection(t.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{t.title || t.name}</div>
                    <div className="text-xs font-mono text-slate-400">ID: {t.id}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-semibold">
            {selectedTemplateIds.length} template(s) selected
          </div>
        </div>
      </div>

      {/* Step 2 — Field type picker + preview */}
      {selectedTemplateIds.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">
            Step 2 — Pick Field Type &amp; Preview
          </p>

          {fieldsLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
              <Loader2 size={16} className={`animate-spin ${env === "dev" ? "text-violet-500" : "text-blue-500"}`} />
              Loading fields from {selectedTemplateIds.length} template(s)…
            </div>
          )}

          {fieldsError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
              <XCircle size={15} /> {fieldsError}
            </div>
          )}

          {!fieldsLoading && !fieldsError && fields.length === 0 && (
            <p className="text-slate-400 text-sm italic text-center py-6">
              No fields found in the selected templates.
            </p>
          )}

          {!fieldsLoading && !fieldsError && fields.length > 0 && (
            <div className="space-y-4">
              {/* Type selector */}
              <div className="max-w-xs">
                <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
                  Field Type
                </label>
                <DevCustomSelect
                  options={typeOptions}
                  value={selectedType}
                  onChange={setSelectedType}
                  placeholder="Select type"
                  icon={CheckSquare2}
                />
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium">
                  {fieldsOfType.length} total <span className="font-mono">{selectedType}</span> field(s)
                </span>
                {needsUpdateCount > 0 && (
                  <span className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-full font-semibold">
                    {needsUpdateCount} will be updated
                  </span>
                )}
                {needsUpdateCount === 0 && fieldsOfType.length > 0 && (
                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-full font-semibold">
                    ✓ All already square
                  </span>
                )}
              </div>

              {/* Preview table (Grouped Hybrid) */}
              <FieldPreviewTable fields={fields} selectedType={selectedType} templates={templates} />
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Apply */}
      {selectedTemplateIds.length > 0 && !fieldsLoading && fields.length > 0 && !result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">
            Step 3 — Apply
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-xs text-amber-700 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              This will update <strong>{needsUpdateCount} {selectedType} field(s)</strong> across <strong>{selectedTemplateIds.length}</strong> template(s) in the <strong>{env === "dev" ? "development" : "production"}</strong> instance. Width will be set equal to height.
            </span>
          </div>

          <button
            id="apply-square-fields-btn"
            onClick={handleApply}
            disabled={applying || needsUpdateCount === 0}
            className={[
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150",
              applying || needsUpdateCount === 0
                ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                : env === "dev" 
                  ? "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200 hover:-translate-y-0.5"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5",
            ].join(" ")}
          >
            {applying ? (
              <><Loader2 size={15} className="animate-spin" /> Applying…</>
            ) : (
              <><CheckSquare2 size={15} /> Square {needsUpdateCount} Field(s)</>
            )}
          </button>
        </div>
      )}

      {/* Result */}
      {result && <ResultPanel result={result} onReset={resetResult} templates={templates} />}
    </div>
  );
}
