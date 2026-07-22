import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Upload,
  XCircle,
  AlertTriangle,
  Users,
  Hash,
  Server,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// ENV Toggle
// ─────────────────────────────────────────────────────────────────────────
function EnvToggle({ env, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
      <button
        onClick={() => onChange("dev")}
        className={[
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
          env === "dev"
            ? "bg-violet-600 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700",
        ].join(" ")}
      >
        <Server size={11} /> Dev
      </button>
      <button
        onClick={() => onChange("prod")}
        className={[
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
          env === "prod"
            ? "bg-orange-500 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700",
        ].join(" ")}
      >
        <Server size={11} /> Prod
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field type badge
// ─────────────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  signature: "bg-purple-50 text-purple-700 border-purple-200",
  text: "bg-blue-50 text-blue-700 border-blue-200",
  enumeration: "bg-teal-50 text-teal-700 border-teal-200",
  checkbox: "bg-green-50 text-green-700 border-green-200",
  radiobutton: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

function FieldTypeBadge({ type, count }) {
  const cls = TYPE_COLORS[type] ?? "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      <span className="capitalize">{type}</span>
      <span className="font-mono font-bold">{count}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FolderNode — recursive expandable folder
// ─────────────────────────────────────────────────────────────────────────
function FolderNode({ folder, selected, onSelectDoc, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState(null); // null = not loaded

  const toggle = async () => {
    if (!expanded && children === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/signnow/folder/${folder.id}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setChildren(data);
      } catch (e) {
        setChildren({ folders: [], documents: [], error: e.message });
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const pl = depth * 16 + 8;

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 transition-colors group"
        style={{ paddingLeft: pl }}
      >
        {loading ? (
          <Loader2 size={13} className="text-amber-400 animate-spin shrink-0" />
        ) : expanded ? (
          <ChevronDown size={13} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-slate-400 shrink-0" />
        )}
        {expanded ? (
          <FolderOpen size={14} className="text-amber-400 shrink-0" />
        ) : (
          <Folder size={14} className="text-amber-400 shrink-0" />
        )}
        <span className="truncate font-medium flex-1 text-left">{folder.name}</span>
        {(folder.totalDocuments > 0 || folder.totalFolders > 0) && (
          <span className="text-xs text-slate-400 font-mono shrink-0 opacity-0 group-hover:opacity-100">
            {folder.totalDocuments}d {folder.totalFolders > 0 ? `${folder.totalFolders}f` : ""}
          </span>
        )}
      </button>

      {expanded && children && (
        <div>
          {children.error && (
            <p className="text-red-500 text-xs px-3 py-1" style={{ paddingLeft: pl + 24 }}>
              {children.error}
            </p>
          )}
          {children.folders?.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              selected={selected}
              onSelectDoc={onSelectDoc}
              depth={depth + 1}
            />
          ))}
          {children.documents?.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              selected={selected?.id === doc.id}
              onSelect={onSelectDoc}
              depth={depth + 1}
            />
          ))}
          {!children.folders?.length && !children.documents?.length && !children.error && (
            <p className="text-slate-400 text-xs italic py-1.5" style={{ paddingLeft: pl + 24 }}>
              Empty folder
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DocumentRow — clickable template item
// ─────────────────────────────────────────────────────────────────────────
function DocumentRow({ doc, selected, onSelect, depth = 0 }) {
  const pl = depth * 16 + 8;
  return (
    <button
      onClick={() => onSelect(doc)}
      className={[
        "w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-all duration-150 group",
        selected
          ? "bg-orange-50 border border-orange-200 text-orange-800"
          : "text-slate-600 hover:bg-blue-50 hover:text-blue-800",
      ].join(" ")}
      style={{ paddingLeft: pl + 20 }}
    >
      <FileText size={13} className={selected ? "text-orange-400 shrink-0" : "text-slate-400 shrink-0"} />
      <span className="truncate flex-1 text-left">{doc.name}</span>
      {doc.pageCount > 0 && (
        <span className="text-xs font-mono text-slate-400 shrink-0">{doc.pageCount}p</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DocPreview — shows field counts and roles for selected document
// ─────────────────────────────────────────────────────────────────────────
function DocPreview({ docId }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docId) { setInfo(null); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/signnow/document/${docId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setInfo(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [docId]);

  if (!docId) return null;
  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
      <Loader2 size={14} className="animate-spin" /> Loading preview…
    </div>
  );
  if (error) return <p className="text-red-500 text-xs py-2">{error}</p>;
  if (!info) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-slate-700 font-semibold text-sm leading-tight">{info.name}</p>
        <span className="text-xs text-slate-400 font-mono shrink-0">{info.pageCount} pages</span>
      </div>

      {/* Roles */}
      {info.roles?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <Users size={11} /> Recipients
          </p>
          <div className="flex flex-wrap gap-1.5">
            {info.roles.map((r) => (
              <span key={r.name} className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {r.signingOrder}. {r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Field counts */}
      {Object.keys(info.fieldCounts).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <Hash size={11} /> Fields ({info.totalFields})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(info.fieldCounts).map(([type, count]) => (
              <FieldTypeBadge key={type} type={type} count={count} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MigrateProgress — SSE consumer
// ─────────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: "Fetch document" },
  { n: 2, label: "Download PDF" },
  { n: 3, label: "Stamp AcroForm" },
  { n: 4, label: "Upload to Documenso" },
];

function MigrateProgress({ payload, onDone, onReset }) {
  const [log, setLog] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);
  const [hasError, setHasError] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await fetch("/api/signnow/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Request failed" }));
          setLog((p) => [...p, { type: "error", message: err.error }]);
          setHasError(true);
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
              if (evt.type === "progress") setCurrentStep(evt.step);
              if (evt.type === "done") { setResult(evt); setDone(true); setCurrentStep(5); }
              if (evt.type === "error") { setHasError(true); setDone(true); }
            } catch (_) {}
          }
        }
      } catch (err) {
        setLog((p) => [...p, { type: "error", message: err.message }]);
        setHasError(true);
        setDone(true);
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="grid grid-cols-2 gap-2">
        {STEPS.map((s) => {
          const isDone = currentStep > s.n;
          const isActive = currentStep === s.n;
          return (
            <div key={s.n} className={[
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-300",
              isDone ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : isActive ? "bg-orange-50 border-orange-200 text-orange-700"
                : "bg-slate-50 border-slate-200 text-slate-400",
            ].join(" ")}>
              <span className={[
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                isDone ? "bg-emerald-500 text-white"
                  : isActive ? "bg-orange-400 text-white"
                  : "bg-slate-200 text-slate-500",
              ].join(" ")}>
                {isDone ? "✓" : s.n}
              </span>
              {isActive && <Loader2 size={11} className="text-orange-400 animate-spin shrink-0" />}
              {s.label}
            </div>
          );
        })}
      </div>

      {/* Console log */}
      <div
        ref={logRef}
        className="bg-slate-900 border border-slate-700 rounded-xl p-4 h-40 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5"
      >
        {log.map((evt, i) => {
          if (evt.type === "progress") return <div key={i} className="text-slate-300">▶ {evt.message}</div>;
          if (evt.type === "done") return <div key={i} className="text-emerald-400 font-semibold">✅ Done! Template ID: {evt.envelopeId}</div>;
          if (evt.type === "error") return <div key={i} className="text-red-400 font-medium">❌ {evt.message}</div>;
          return null;
        })}
        {!done && <div className="text-slate-600 animate-pulse mt-1">█</div>}
      </div>

      {/* Result */}
      {done && !hasError && result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-emerald-500" />
            <p className="text-emerald-800 font-semibold text-sm">Template migrated successfully!</p>
          </div>
          <p className="text-emerald-700 text-xs">
            Template ID: <span className="font-mono font-bold">{result.envelopeId}</span>
          </p>
          <p className="text-emerald-600 text-xs mt-1">
            Destination: <span className="font-semibold uppercase">{result.env}</span>
          </p>
        </div>
      )}
      {done && hasError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <XCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-red-700 text-sm font-medium">Migration failed. Check the log above.</p>
        </div>
      )}

      {done && (
        <div className="flex justify-end">
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-orange-600 hover:text-orange-700 text-sm font-semibold bg-orange-50 hover:bg-orange-100 border border-orange-200 px-4 py-2 rounded-xl transition-all"
          >
            <RotateCcw size={13} /> Migrate Another
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────
export default function SignNowMigratePage() {
  const [env, setEnv] = useState("dev");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rootData, setRootData] = useState(null); // { folders, documents }
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [destFolderId, setDestFolderId] = useState("");
  const [docuFolders, setDocuFolders] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [migratePayload, setMigratePayload] = useState(null);

  const loadRoot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signnow/folders");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRootData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load Documenso folders for selected env
  const loadDocuFolders = async (e) => {
    const api = e === "dev" ? "/api/dev/folders" : "/api/folders";
    try {
      const res = await fetch(api);
      const data = await res.json();
      setDocuFolders(data.folders ?? []);
    } catch (_) {
      setDocuFolders([]);
    }
  };

  useEffect(() => { loadRoot(); }, []);
  useEffect(() => { loadDocuFolders(env); }, [env]);

  const handleSelectDoc = (doc) => {
    setSelectedDoc(doc);
    setTitle(doc.name);
    setMigrating(false);
    setMigratePayload(null);
  };

  const handleMigrate = () => {
    if (!selectedDoc || !title.trim()) return;
    setMigratePayload({
      documentId: selectedDoc.id,
      templateTitle: title.trim(),
      env,
      folderId: destFolderId || undefined,
    });
    setMigrating(true);
  };

  const handleReset = () => {
    setMigrating(false);
    setMigratePayload(null);
    setSelectedDoc(null);
    setTitle("");
  };

  const envLabel = env === "dev" ? "Development" : "Production";
  const envColor = env === "dev" ? "text-violet-700 bg-violet-50 border-violet-200" : "text-orange-700 bg-orange-50 border-orange-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 text-orange-600 text-xs font-semibold mb-3">
          <Upload size={12} /> Migrate from SignNow
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">SignNow → Documenso</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Browse your SignNow templates, pick one, and migrate it to Documenso with all fields and recipients preserved.
        </p>
      </div>

      {/* Env selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-0.5">Target Environment</p>
          <p className={`text-xs font-medium px-2 py-0.5 rounded-full border inline-block ${envColor}`}>
            {envLabel}
          </p>
        </div>
        <EnvToggle env={env} onChange={setEnv} />
      </div>

      {/* Folder browser + detail panel */}
      {!migrating && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: folder tree */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
                SignNow Templates
              </p>
              <button
                onClick={loadRoot}
                disabled={loading}
                className="text-slate-400 hover:text-orange-600 p-1 rounded-lg hover:bg-orange-50 transition-all"
                title="Refresh"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
                <Loader2 size={16} className="animate-spin" /> Loading templates…
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs flex items-start gap-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Failed to load SignNow folders</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {!loading && !error && rootData && (
              <div className="max-h-80 overflow-y-auto space-y-0.5">
                {rootData.folders?.map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    selected={selectedDoc}
                    onSelectDoc={handleSelectDoc}
                    depth={0}
                  />
                ))}
                {rootData.documents?.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    selected={selectedDoc?.id === doc.id}
                    onSelect={handleSelectDoc}
                    depth={0}
                  />
                ))}
                {!rootData.folders?.length && !rootData.documents?.length && (
                  <p className="text-slate-400 text-sm italic text-center py-4">
                    No templates found in root folder.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: config + preview */}
          <div className="space-y-4">
            {/* Selected doc preview */}
            {selectedDoc ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Selected Template</p>
                <DocPreview docId={selectedDoc?.id} />

                {/* Title */}
                <div>
                  <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
                    Template Title in Documenso
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Template name…"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder-slate-300"
                  />
                </div>

                {/* Destination folder */}
                <div>
                  <label className="block text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1.5">
                    Destination Folder ({envLabel})
                  </label>
                  <select
                    value={destFolderId}
                    onChange={(e) => setDestFolderId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                  >
                    <option value="">No folder (root)</option>
                    {docuFolders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* Migrate button */}
                <button
                  id="btn-start-migrate"
                  onClick={handleMigrate}
                  disabled={!title.trim()}
                  className={[
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150",
                    title.trim()
                      ? env === "dev"
                        ? "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-100 hover:-translate-y-0.5"
                        : "bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-100 hover:-translate-y-0.5"
                      : "bg-slate-100 text-slate-300 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Upload size={14} />
                  Migrate to {envLabel}
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
                <FileText size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">
                  Select a template from the folder tree
                </p>
                <p className="text-slate-300 text-xs mt-1">
                  Expand folders to browse documents
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Migration progress */}
      {migrating && migratePayload && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1">Migrating</p>
            <p className="text-slate-800 font-bold text-lg leading-tight">{migratePayload.templateTitle}</p>
            <p className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full border inline-block ${envColor}`}>
              → {envLabel}
            </p>
          </div>
          <MigrateProgress
            payload={migratePayload}
            onDone={() => {}}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  );
}
