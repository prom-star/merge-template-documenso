import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RotateCcw,
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FilePlus2,
  Folder,
  FolderOpen,
  RefreshCw,
  Info,
  Copy,
  CheckSquare2,
  Upload,
} from "lucide-react";
import UpdateFieldsSizePage from "./UpdateFieldsSizePage.jsx";
import SignNowMigratePage from "./SignNowMigratePage.jsx";

// ─────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────

let _id = 0;
const newCombo = (defaultFolderId) => ({
  id: ++_id,
  title: "",
  templates: [], // full template objects instead of just IDs
  folderId: defaultFolderId ?? null,
  sourceFolderId: "all", // "all", "config", or a folder ID
});

const STEPS = ["Build", "Confirm", "Progress", "Summary"];

// ─────────────────────────────────────────────────────────────────────────
// StepIndicator
// ─────────────────────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <nav
      aria-label="Progress"
      className="flex items-center justify-center gap-0 mb-10 select-none"
    >
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  done
                    ? "bg-blue-500 text-white"
                    : active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110 ring-4 ring-blue-100"
                    : "bg-slate-100 text-slate-400 border border-slate-200",
                ].join(" ")}
              >
                {done ? <CheckCircle size={15} /> : step}
              </div>
              <span
                className={[
                  "text-xs font-medium transition-colors duration-300",
                  active
                    ? "text-blue-600"
                    : done
                    ? "text-blue-400"
                    : "text-slate-400",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "w-14 h-0.5 mx-2 mb-5 transition-colors duration-500 rounded-full",
                  step < current ? "bg-blue-400" : "bg-slate-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TemplateChip
// ─────────────────────────────────────────────────────────────────────────
function TemplateChip({ template, index, total, onRemove, onMoveLeft, onMoveRight }) {
  return (
    <div className="group flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg pl-2.5 pr-1.5 py-1.5 text-blue-800">
      <span className="text-blue-400 text-xs font-mono font-medium">{index + 1}.</span>
      <span className="text-sm font-medium mx-1 max-w-[180px] truncate" title={template.title}>
        {template.title}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {index > 0 && (
          <button
            onClick={onMoveLeft}
            title="Move left"
            className="text-blue-400 hover:text-blue-700 transition-colors p-0.5 rounded hover:bg-blue-100"
          >
            <ArrowLeft size={11} />
          </button>
        )}
        {index < total - 1 && (
          <button
            onClick={onMoveRight}
            title="Move right"
            className="text-blue-400 hover:text-blue-700 transition-colors p-0.5 rounded hover:bg-blue-100"
          >
            <ArrowRight size={11} />
          </button>
        )}
        <button
          onClick={onRemove}
          title="Remove"
          className="text-blue-300 hover:text-red-500 transition-colors p-0.5 rounded hover:bg-red-50"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CustomSelect (replaces native <select> for richer UI)
// ─────────────────────────────────────────────────────────────────────────
function CustomSelect({ options, value, onChange, placeholder, icon: Icon, className = "bg-white border-slate-200 text-slate-700 focus:border-blue-400 focus:ring-blue-100", iconClass = "text-slate-400", chevronClass = "text-slate-400" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (o.value || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm text-left focus:outline-none focus:ring-2 transition-all shadow-sm ${className}`}
      >
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          {Icon && <Icon size={14} className={iconClass} />}
        </div>
        <span className="block truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <ChevronRight size={13} className={`transition-transform ${chevronClass} ${isOpen ? "-rotate-90" : "rotate-90"}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 flex flex-col focus:outline-none">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all placeholder-slate-400"
            />
          </div>
          <ul className="py-1 overflow-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-400 italic">
                No folders found
              </li>
            ) : (
              filteredOptions.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${
                    option.value === value ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-slate-700">{option.label}</div>
                  {option.subLabel && (
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{option.subLabel}</div>
                  )}
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
// FolderSelect & SourceFolderSelect
// ─────────────────────────────────────────────────────────────────────────
function FolderSelect({ folders, value, defaultFolderId, onChange }) {
  const options = [
    { value: "", label: "Use default (from config)", subLabel: "Uses fallback config" },
    ...folders.map(f => ({
      value: f.id,
      label: f.name + (f.id === defaultFolderId && f.id !== "" ? " ★" : ""),
      subLabel: `ID: ${f.id}`
    }))
  ];

  return (
    <CustomSelect 
      options={options} 
      value={value ?? ""} 
      onChange={(val) => onChange(val || null)} 
      icon={Folder} 
      placeholder="Select destination"
    />
  );
}

function SourceFolderSelect({ folders, value, onChange }) {
  const options = [
    { value: "all", label: "All Folders (Search everywhere)", subLabel: "Include all root templates" },
    { value: "config", label: "Templates from config.js", subLabel: "Local hardcoded templates" },
    ...folders.map(f => ({
      value: f.id,
      label: f.name,
      subLabel: `ID: ${f.id}`
    }))
  ];

  return (
    <CustomSelect 
      options={options} 
      value={value ?? "all"} 
      onChange={onChange} 
      icon={FolderOpen}
      placeholder="Select source folder"
      className="bg-blue-50 border-blue-200 text-blue-900 focus:border-blue-400 focus:ring-blue-100"
      iconClass="text-blue-400"
      chevronClass="text-blue-400"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CombinationCard
// ─────────────────────────────────────────────────────────────────────────
function CombinationCard({
  combo,
  folders,
  defaultFolderId,
  index,
  onChange,
  onRemove,
  onDuplicate,
}) {
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch templates for the selected source folder dynamically
  useEffect(() => {
    let url = "/api/templates?";
    if (combo.sourceFolderId === "config") {
      url += "source=config";
    } else if (combo.sourceFolderId) {
      url += `folderId=${combo.sourceFolderId}`;
    }

    setLoadingTemplates(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => setAvailableTemplates(data.templates || []))
      .catch((err) => console.error("Failed to fetch templates:", err))
      .finally(() => setLoadingTemplates(false));
  }, [combo.sourceFolderId]);

  const selectedTemplates = combo.templates || [];
  const available = availableTemplates.filter(
    (t) => !selectedTemplates.find((s) => s.id === t.id)
  );

  const addTemplate = (t) =>
    onChange({ ...combo, templates: [...selectedTemplates, t] });

  const removeTemplate = (id) =>
    onChange({
      ...combo,
      templates: selectedTemplates.filter((x) => x.id !== id),
    });

  const moveTemplate = (from, to) => {
    const next = [...selectedTemplates];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ ...combo, templates: next });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {index + 1}
          </div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
            Combination
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              title="Duplicate combination"
              className="text-slate-300 hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-blue-50"
            >
              <Copy size={13} />
            </button>
          )}
          {onRemove && (
            <button
              id={`remove-combo-${combo.id}`}
              onClick={onRemove}
              title="Remove combination"
              className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label
          htmlFor={`combo-title-${combo.id}`}
          className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5"
        >
          Merged Template Title
        </label>
        <input
          id={`combo-title-${combo.id}`}
          type="text"
          placeholder="e.g., Var Level 1 — Release to Client Only"
          value={combo.title}
          onChange={(e) => onChange({ ...combo, title: e.target.value })}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-300 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Source Folder */}
        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
            Pick Templates From Folder
          </label>
          <SourceFolderSelect
            folders={folders}
            value={combo.sourceFolderId}
            onChange={(val) => onChange({ ...combo, sourceFolderId: val })}
          />
        </div>

        {/* Destination folder */}
        <div>
          <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
            Destination Folder
          </label>
          <FolderSelect
            folders={folders}
            value={combo.folderId}
            defaultFolderId={defaultFolderId}
            onChange={(val) => onChange({ ...combo, folderId: val })}
          />
        </div>
      </div>

      {/* Selected templates (merge order) */}
      <div className="mb-4">
        <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
          Merge Order{" "}
          <span className="text-slate-300 normal-case tracking-normal font-normal ml-1">
            hover to reorder / remove
          </span>
        </label>
        <div className="min-h-[52px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap gap-2">
          {selectedTemplates.length === 0 ? (
            <span className="text-slate-300 text-sm italic px-1 py-0.5 self-center">
              Click a template below to add →
            </span>
          ) : (
            selectedTemplates.map((t, ki) => (
              <TemplateChip
                key={t.id + "-" + ki}
                template={t}
                index={ki}
                total={selectedTemplates.length}
                onRemove={() => removeTemplate(t.id)}
                onMoveLeft={() => moveTemplate(ki, ki - 1)}
                onMoveRight={() => moveTemplate(ki, ki + 1)}
              />
            ))
          )}
        </div>
      </div>

      {/* Available templates */}
      <div className="min-h-[60px]">
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-slate-400 text-xs font-semibold uppercase tracking-widest">
            Available Templates
          </label>
          {loadingTemplates && (
            <Loader2 size={12} className="text-blue-500 animate-spin" />
          )}
        </div>

        {!loadingTemplates && available.length === 0 ? (
          <p className="text-slate-400 text-sm italic px-1">
            No templates found in this folder.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {available.map((t) => (
              <button
                key={t.id}
                id={`add-template-${combo.id}-${t.id}`}
                onClick={() => addTemplate(t)}
                title={`ID: ${t.id}${t.configKey ? ` · Key: ${t.configKey}` : ""}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all duration-150"
              >
                <Plus size={10} />
                <span className="max-w-[160px] truncate">{t.title}</span>
                {t.source === "api" && !t.configKey && (
                  <span className="text-blue-400 font-mono text-[10px]">#{t.id}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 1 — Builder
// ─────────────────────────────────────────────────────────────────────────
function BuilderStep({
  folders,
  defaultFolderId,
  combinations,
  setCombinations,
  onNext,
}) {
  const addCombo = () =>
    setCombinations((p) => [...p, newCombo(defaultFolderId)]);

  const duplicateCombo = (combo) => {
    setCombinations((p) => [
      ...p,
      {
        ...combo,
        id: ++_id,
        title: combo.title ? `${combo.title} (Copy)` : "",
      },
    ]);
  };

  const removeCombo = (id) =>
    setCombinations((p) => p.filter((c) => c.id !== id));

  const updateCombo = (id, updated) =>
    setCombinations((p) => p.map((c) => (c.id === id ? updated : c)));

  const validCount = combinations.filter(
    (c) => c.title.trim() && (c.templates || []).length >= 1
  ).length;
  const isReady =
    validCount === combinations.length && combinations.length > 0;

  return (
    <div>
      {/* Section header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 text-blue-600 text-xs font-semibold mb-4">
          <Sparkles size={12} />
          Step 1 of 4
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Build Your Combinations
        </h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Create one or more merged template combinations. Templates are merged
          in the order you add them — first listed = first pages.
        </p>
      </div>

      {/* Combination cards */}
      <div className="space-y-4 mb-6">
        {combinations.map((combo, i) => (
          <CombinationCard
            key={combo.id}
            combo={combo}
            folders={folders}
            defaultFolderId={defaultFolderId}
            index={i}
            onChange={(updated) => updateCombo(combo.id, updated)}
            onRemove={combinations.length > 1 ? () => removeCombo(combo.id) : null}
            onDuplicate={() => duplicateCombo(combo)}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          id="add-combination-btn"
          onClick={addCombo}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2.5 rounded-xl transition-all duration-150"
        >
          <FilePlus2 size={14} />
          Add Another Combination
        </button>

        <div className="flex items-center gap-4">
          {validCount > 0 && (
            <span className="text-slate-400 text-sm">
              <span className="text-blue-600 font-semibold">{validCount}</span> template
              {validCount !== 1 ? "s" : ""} will be created
            </span>
          )}
          <button
            id="next-to-confirm-btn"
            onClick={onNext}
            disabled={!isReady}
            className={[
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150",
              isReady
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5"
                : "bg-slate-100 text-slate-300 cursor-not-allowed",
            ].join(" ")}
          >
            Preview <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2 — Confirmation
// ─────────────────────────────────────────────────────────────────────────
function ConfirmationStep({ combinations, folders, defaultFolderId, onBack, onConfirm }) {
  const getFolder = (folderId) => {
    if (!folderId) return folders.find((f) => f.id === defaultFolderId) ?? { name: "Default (config)" };
    return folders.find((f) => f.id === folderId) ?? { name: folderId };
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-amber-500" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Confirm Creation</h2>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          Review each combination before submitting. New templates will be
          created in your Documenso account.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {combinations.map((combo, i) => {
          const folder = getFolder(combo.folderId);
          return (
            <div
              key={combo.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold mt-0.5 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-semibold text-sm mb-2">
                    {combo.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {combo.templates.map((t, ki) => (
                      <div key={t.id + "-" + ki} className="flex items-center gap-1.5">
                        <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-medium max-w-[160px] truncate">
                          {t.title ?? `#${t.id}`}
                        </span>
                        {ki < combo.templates.length - 1 && (
                          <ChevronRight size={12} className="text-slate-300" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <FolderOpen size={12} />
                    <span>Destination: {folder?.name ?? "Default"}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6 text-xs text-amber-700 flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <span>
          This will create{" "}
          <strong>{combinations.length} template{combinations.length !== 1 ? "s" : ""}</strong>{" "}
          in Documenso. Duplicates will not be removed automatically.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <button
          id="back-to-build-btn"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-150"
        >
          <ChevronLeft size={15} /> Back
        </button>
        <button
          id="confirm-create-btn"
          onClick={onConfirm}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100 hover:-translate-y-0.5 transition-all duration-150"
        >
          <CheckCircle size={15} /> Confirm &amp; Create
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3 — Progress (SSE consumer)
// ─────────────────────────────────────────────────────────────────────────
function ProgressStep({ combinations, onDone }) {
  const [log, setLog] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [phase, setPhase] = useState("Connecting…");
  const [done, setDone] = useState(false);
  const [results, setResults] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await fetch("/api/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            combinations: combinations.map((c) => ({
              title: c.title,
              templateIds: c.templates.map((t) => t.id),
              folderId: c.folderId,
            })),
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Request failed" }));
          setLog((p) => [...p, { type: "fatal", error: err.error }]);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              setLog((p) => [...p, evt]);
              switch (evt.type) {
                case "phase":
                  setPhase(evt.message);
                  break;
                case "combo-start":
                  setStatuses((p) => ({ ...p, [evt.index]: "running" }));
                  break;
                case "combo-done":
                  setStatuses((p) => ({ ...p, [evt.index]: "ok" }));
                  break;
                case "combo-error":
                  setStatuses((p) => ({ ...p, [evt.index]: "error" }));
                  break;
                case "done":
                  setResults(evt.results);
                  setDone(true);
                  setPhase("All done!");
                  break;
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        setLog((p) => [...p, { type: "fatal", error: err.message }]);
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logLine = (evt, i) => {
    const styles = {
      "combo-done": "text-emerald-600 font-medium",
      "combo-error": "text-red-500",
      fatal: "text-red-500 font-medium",
      phase: "text-blue-400 font-semibold",
      "template-ready": "text-blue-300",
      "template-error": "text-red-400",
    };
    const cls = styles[evt.type] || "text-slate-500";

    const text = (() => {
      switch (evt.type) {
        case "phase":           return `▶  ${evt.message}`;
        case "template-fetch":  return `   ↳ ${evt.message}`;
        case "template-ready":  return `   ✓ #${evt.id} "${evt.title}" ready`;
        case "template-error":  return `   ✗ #${evt.id}: ${evt.error}`;
        case "combo-start":     return `▶  ${evt.title}`;
        case "combo-progress":  return `   ${evt.message}`;
        case "combo-done":      return `   ✅ Created — Envelope ID: ${evt.envelopeId}`;
        case "combo-error":     return `   ❌ Failed — ${evt.error}`;
        case "fatal":           return `❌ Fatal: ${evt.error}`;
        default:                return null;
      }
    })();

    if (!text) return null;
    return (
      <div key={i} className={cls}>
        {text}
      </div>
    );
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {done ? "All Done!" : "Creating Templates…"}
        </h2>
        <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
          {!done && <Loader2 size={13} className="animate-spin text-blue-500" />}
          {phase}
        </p>
      </div>

      {/* Per-combination status */}
      <div className="space-y-2.5 mb-6">
        {combinations.map((combo, i) => {
          const status = statuses[i];
          const style = {
            running: "bg-blue-50 border-blue-200",
            ok: "bg-emerald-50 border-emerald-200",
            error: "bg-red-50 border-red-200",
          }[status] ?? "bg-slate-50 border-slate-200";

          return (
            <div
              key={combo.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-500 ${style}`}
            >
              <div className="shrink-0 w-5 flex items-center justify-center">
                {!status && <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                {status === "running" && (
                  <Loader2 size={18} className="text-blue-500 animate-spin" />
                )}
                {status === "ok" && (
                  <CheckCircle size={18} className="text-emerald-500" />
                )}
                {status === "error" && (
                  <XCircle size={18} className="text-red-500" />
                )}
              </div>
              <div>
                <p className="text-slate-700 text-sm font-semibold leading-tight">
                  {combo.title}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {combo.templates.length} template(s)
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Console log */}
      <div
        ref={logRef}
        className="bg-slate-900 border border-slate-700 rounded-xl p-4 h-44 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5 mb-6"
      >
        {log.map((evt, i) => logLine(evt, i))}
        {!done && <div className="text-slate-600 animate-pulse mt-1">█</div>}
      </div>

      {done && (
        <div className="flex justify-end">
          <button
            id="view-summary-btn"
            onClick={() => onDone(results)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-150"
          >
            View Summary <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 4 — Summary
// ─────────────────────────────────────────────────────────────────────────
function SummaryStep({ results, onReset }) {
  const ok = results.filter((r) => r.status === "ok");
  const errors = results.filter((r) => r.status === "error");

  return (
    <div>
      <div className="text-center mb-8">
        <div
          className={[
            "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border",
            errors.length === 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200",
          ].join(" ")}
        >
          {errors.length === 0 ? (
            <CheckCircle className="text-emerald-500" size={26} />
          ) : (
            <AlertTriangle className="text-amber-500" size={26} />
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          {errors.length === 0 ? "All Templates Created!" : "Completed with Issues"}
        </h2>
        <p className="text-slate-500 text-sm">
          <span className="text-emerald-600 font-semibold">{ok.length} created</span>
          {errors.length > 0 && (
            <>
              {" · "}
              <span className="text-red-500 font-semibold">{errors.length} failed</span>
            </>
          )}
        </p>
      </div>

      <div className="space-y-2.5 mb-8">
        {results.map((r, i) => (
          <div
            key={i}
            className={[
              "flex items-start gap-3 p-4 rounded-xl border",
              r.status === "ok"
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200",
            ].join(" ")}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {r.status === "ok" ? (
              <CheckCircle size={17} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={17} className="text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 text-sm font-semibold leading-tight truncate">
                {r.title}
              </p>
              {r.status === "ok" ? (
                <p className="text-emerald-600 text-xs mt-0.5">
                  Envelope ID:{" "}
                  <span className="font-mono">{r.envelopeId}</span>
                </p>
              ) : (
                <p className="text-red-500 text-xs mt-0.5 truncate">{r.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          id="start-over-btn"
          onClick={onReset}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-5 py-2.5 rounded-xl transition-all duration-150"
        >
          <RotateCcw size={13} /> Start Over
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("merge"); // "merge" | "update-fields"
  const [step, setStep] = useState(1);
  const [folders, setFolders] = useState([]);
  const [defaultFolderId, setDefaultFolderId] = useState(null);
  const [combinations, setCombinations] = useState([newCombo(null)]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const folderRes = await fetch("/api/folders");

      if (!folderRes.ok) {
        throw new Error(
          `Server responded: folders=${folderRes.status}`
        );
      }

      const folderData = await folderRes.json();
      setFolders(folderData.folders ?? []);
      
      const defId = folderData.defaultFolderId ?? null;
      setDefaultFolderId(defId);
      
      // Update combos if they had a null folderId initially
      setCombinations((prev) =>
        prev.map((c) => ({
          ...c,
          folderId: c.folderId === null ? defId : c.folderId,
        }))
      );

      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    setRefreshing(true);
    loadData();
  };

  const reset = () => {
    setCombinations([newCombo(defaultFolderId)]);
    setResults([]);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
            <FileText size={15} className="text-white" />
          </div>
          <div className="shrink-0">
            <h1 className="text-slate-800 font-bold text-sm leading-none tracking-tight">
              PDF Merge Studio
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Documenso Template Merger
            </p>
          </div>

          {/* Tab switcher */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mx-auto">
            <button
              id="tab-merge"
              onClick={() => setActiveTab("merge")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                activeTab === "merge"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              <FileText size={12} /> Merge Templates
            </button>
            <button
              id="tab-update-fields"
              onClick={() => setActiveTab("update-fields")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                activeTab === "update-fields"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              <CheckSquare2 size={12} /> Update Fields Size
            </button>
            <button
              id="tab-signnow-migrate"
              onClick={() => setActiveTab("signnow-migrate")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                activeTab === "signnow-migrate"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              <Upload size={12} /> Migrate from SignNow
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {/* Refresh button — only relevant for merge tab */}
            {activeTab === "merge" && (
              <button
                onClick={refresh}
                disabled={refreshing}
                title="Refresh folders"
                className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
            )}

            {/* Status dot */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  loadError
                    ? "bg-red-400"
                    : loading
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400"
                }`}
              />
              {loadError ? "Offline" : loading ? "Loading" : "Connected"}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Update Fields Size tab */}
          {activeTab === "update-fields" && <UpdateFieldsSizePage />}

          {/* Migrate from SignNow tab */}
          {activeTab === "signnow-migrate" && <SignNowMigratePage />}

          {/* Merge Templates tab */}
          {activeTab === "merge" && <StepIndicator current={step} />}

          {/* Loading — merge tab only */}
          {activeTab === "merge" && loading && (
            <div className="text-center py-24">
              <Loader2 size={36} className="text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-sm">
                Loading folders from Documenso…
              </p>
            </div>
          )}

          {/* Load error — merge tab only */}
          {activeTab === "merge" && loadError && (
            <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm">
              <XCircle size={36} className="text-red-400 mx-auto mb-3" />
              <p className="text-slate-700 font-semibold mb-1">Failed to connect</p>
              <p className="text-slate-400 text-sm mb-4">{loadError}</p>
              <p className="text-slate-300 text-xs mb-4">
                Make sure{" "}
                <code className="text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                  node server.js
                </code>{" "}
                is running on port 3001.
              </p>
              <button
                onClick={refresh}
                className="flex items-center gap-2 mx-auto text-blue-600 font-semibold text-sm bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-xl transition-all"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {/* Steps — merge tab only */}
          {activeTab === "merge" && !loading && !loadError && step === 1 && (
            <BuilderStep
              folders={folders}
              defaultFolderId={defaultFolderId}
              combinations={combinations}
              setCombinations={setCombinations}
              onNext={() => setStep(2)}
            />
          )}
          {activeTab === "merge" && !loading && !loadError && step === 2 && (
            <ConfirmationStep
              combinations={combinations}
              folders={folders}
              defaultFolderId={defaultFolderId}
              onBack={() => setStep(1)}
              onConfirm={() => setStep(3)}
            />
          )}
          {activeTab === "merge" && !loading && !loadError && step === 3 && (
            <ProgressStep
              combinations={combinations}
              onDone={(res) => {
                setResults(res);
                setStep(4);
              }}
            />
          )}
          {activeTab === "merge" && !loading && !loadError && step === 4 && (
            <SummaryStep results={results} onReset={reset} />
          )}
        </div>
      </main>
    </div>
  );
}
