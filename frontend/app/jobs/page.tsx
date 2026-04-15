"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, ExternalLink, Link2, ChevronDown,
  Loader2, Check, X, MessageSquare, Download,
} from "lucide-react";
import { apiFetch, apiFetchRaw } from "@/lib/api";
import { JobApplication, Resume } from "@/lib/types";

// ---- Status config ----

type StatusKey = "applied" | "phone_screen" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<StatusKey, { label: string; style: string }> = {
  applied:      { label: "Applied",       style: "bg-blue-100 text-blue-700" },
  phone_screen: { label: "Phone Screen",  style: "bg-amber-100 text-amber-700" },
  interview:    { label: "Interview",     style: "bg-violet-100 text-violet-700" },
  offer:        { label: "Offer",         style: "bg-emerald-100 text-emerald-700" },
  rejected:     { label: "Rejected",      style: "bg-red-100 text-red-600" },
};

const JOB_TYPE_STYLE: Record<string, string> = {
  remote: "bg-teal-50 text-teal-700",
  hybrid: "bg-amber-50 text-amber-700",
  onsite: "bg-slate-100 text-slate-600",
};

const SALARY_TYPES = [
  { value: "hourly",  label: "/ hr",  long: "Per Hour" },
  { value: "weekly",  label: "/ wk",  long: "Per Week" },
  { value: "monthly", label: "/ mo",  long: "Per Month" },
  { value: "yearly",  label: "/ yr",  long: "Per Year" },
];

function salaryTypeLabel(type: string | null) {
  return SALARY_TYPES.find((t) => t.value === type)?.label ?? null;
}

function statusCfg(s: string | null) {
  return STATUS_CONFIG[s as StatusKey] ?? { label: s ?? "—", style: "bg-slate-100 text-slate-500" };
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---- Download helper ----
async function downloadFile(id: number, filename: string) {
  const res = await apiFetchRaw(`/resumes/${id}/download`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Adaptive drop direction helper ----
function getDropDir(el: HTMLElement, needed = 220): "up" | "down" {
  const rect = el.getBoundingClientRect();
  return window.innerHeight - rect.bottom < needed ? "up" : "down";
}

// ---- Status dropdown (adaptive direction) ----

function StatusDropup({ value, onChange }: { value: string | null; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");
  const ref = useRef<HTMLDivElement>(null);
  const cfg = statusCfg(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && ref.current) setDir(getDropDir(ref.current, 220));
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${cfg.style}`}
      >
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className={`absolute left-0 z-30 w-40 bg-white border border-slate-100 rounded-xl shadow-lg py-1 ${dir === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {Object.entries(STATUS_CONFIG).map(([key, { label, style }]) => (
            <button
              key={key}
              onClick={(e) => { e.stopPropagation(); onChange(key); setOpen(false); }}
              className="flex items-center w-full px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- File dropup (resume / cover letter) ----

function FileDropup({
  value,
  options,
  placeholder,
  nullable,
  onChange,
}: {
  value: number | null;
  options: Resume[];
  placeholder: string;
  nullable: boolean;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [downloading, setDownloading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((r) => r.id === value) ?? null;

  if (options.length === 0) {
    return (
      <span className="text-xs text-slate-400 whitespace-nowrap">
        <Link href="/resumes" className="text-indigo-500 hover:underline">Add files</Link> first
      </span>
    );
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!selected) return;
    setDownloading(true);
    try { await downloadFile(selected.id, selected.filename); } finally { setDownloading(false); }
  }

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && ref.current) setDir(getDropDir(ref.current, 230));
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1 min-w-0">
      {selected ? (
        <>
          {/* Name = download trigger */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            title={`Download ${selected.name}`}
            className="text-xs text-indigo-600 hover:underline truncate max-w-[110px] text-left leading-tight"
          >
            {downloading ? <Loader2 size={11} className="animate-spin inline" /> : selected.name}
          </button>
          {/* Chevron = open dropdown to change */}
          <button
            onClick={handleOpen}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
          >
            <ChevronDown size={10} />
          </button>
        </>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span>{placeholder}</span>
          <ChevronDown size={10} />
        </button>
      )}

      {open && (
        <div className={`absolute left-0 z-30 w-52 bg-white border border-slate-100 rounded-xl shadow-lg py-1 max-h-52 overflow-y-auto ${dir === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {nullable && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
              className="flex items-center w-full px-3 py-2 hover:bg-slate-50 transition-colors text-xs text-slate-400"
            >
              — Not required
            </button>
          )}
          {!nullable && value !== null && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
              className="flex items-center w-full px-3 py-2 hover:bg-slate-50 transition-colors text-xs text-slate-400"
            >
              — None
            </button>
          )}
          {options.map((r) => (
            <button
              key={r.id}
              onClick={(e) => { e.stopPropagation(); onChange(r.id); setOpen(false); }}
              className={`flex items-center w-full px-3 py-2 hover:bg-slate-50 transition-colors text-xs text-left gap-2 ${
                r.id === value ? "font-semibold text-indigo-600" : "text-slate-700"
              }`}
            >
              <span className="truncate flex-1">{r.name}</span>
              {r.id === value && <Download size={11} className="flex-shrink-0 opacity-60" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- File select for inline add row (simpler, no download needed) ----

function FileSelect({
  value,
  options,
  placeholder,
  nullable,
  onChange,
}: {
  value: number | null;
  options: Resume[];
  placeholder: string;
  nullable: boolean;
  onChange: (id: number | null) => void;
}) {
  if (options.length === 0) {
    return (
      <span className="text-[10px] text-slate-400 leading-tight">
        <Link href="/resumes" className="text-indigo-400 hover:underline">Upload files</Link> first
      </span>
    );
  }
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full border border-slate-200 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
    >
      <option value="">{nullable ? "Not required" : placeholder}</option>
      {options.map((r) => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </select>
  );
}

// ---- Comments cell ----

function CommentCell({ value, onEdit }: { value: string | null; onEdit: () => void }) {
  if (!value) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="text-slate-300 hover:text-slate-500 transition-colors"
        title="Add comment"
      >
        <MessageSquare size={14} />
      </button>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      className="text-left group/comment max-w-[180px] block"
      title={value}
    >
      <span className="text-xs text-slate-500 line-clamp-2 group-hover/comment:text-slate-800 transition-colors leading-relaxed">
        {value}
      </span>
    </button>
  );
}

// ---- Location cell (inline editable) ----

function LocationCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");

  function commit() {
    setEditing(false);
    const next = text.trim() || null;
    if (next !== value) onSave(next);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-[120px] border-b border-indigo-400 bg-transparent text-sm text-slate-700 focus:outline-none py-0.5"
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setText(value ?? ""); setEditing(true); }}
      className="text-sm text-slate-600 hover:text-slate-900 text-left truncate block max-w-[130px] leading-tight"
      title={value ?? "Click to set location"}
    >
      {value ?? <span className="text-slate-300">—</span>}
    </button>
  );
}

// ---- Salary cell (popover with type selector + amount) ----

function SalaryCell({
  range,
  type,
  onSave,
}: {
  range: string | null;
  type: string | null;
  onSave: (range: string | null, type: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [editRange, setEditRange] = useState(range ?? "");
  const [editType, setEditType] = useState(type ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function openEditor(e: React.MouseEvent) {
    e.stopPropagation();
    setEditRange(range ?? "");
    setEditType(type ?? "");
    if (!open && ref.current) setDir(getDropDir(ref.current, 210));
    setOpen((o) => !o);
  }

  function save() {
    setOpen(false);
    onSave(editRange.trim() || null, editType || null);
  }

  const typeLabel = salaryTypeLabel(type);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openEditor}
        className="text-sm text-slate-600 hover:text-slate-900 text-left leading-tight"
      >
        {range ? (
          <span>
            {range}
            {typeLabel && <span className="text-xs text-slate-400 ml-1">{typeLabel}</span>}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </button>

      {open && (
        <div className={`absolute left-0 z-30 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-3 flex flex-col gap-2 ${dir === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Type</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">— Select type</option>
              {SALARY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.long}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Amount</label>
            <input
              autoFocus
              type="text"
              value={editRange}
              onChange={(e) => setEditRange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="e.g. $80k – $120k"
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
            <button onClick={save} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Inline form type ----

interface InlineForm {
  company: string;
  role: string;
  url: string;
  status: string;
  date_applied: string;
  location: string;
  job_type: string;
  salary_range: string;
  salary_type: string;
  notes: string;
  resume_id: number | null;
  cover_letter_id: number | null;
}

const EMPTY_INLINE: InlineForm = {
  company: "", role: "", url: "", status: "applied",
  date_applied: "", location: "", job_type: "",
  salary_range: "", salary_type: "", notes: "", resume_id: null, cover_letter_id: null,
};

// ---- Inline row for adding a new job ----

function InlineAddRow({
  onSave,
  onCancel,
  resumeOptions,
  coverLetterOptions,
}: {
  onSave: (form: InlineForm) => Promise<void>;
  onCancel: () => void;
  resumeOptions: Resume[];
  coverLetterOptions: Resume[];
}) {
  const [form, setForm] = useState<InlineForm>({ ...EMPTY_INLINE, date_applied: toLocalDate(new Date()) });
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof InlineForm>(key: K, value: InlineForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.company.trim() || !form.role.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const inputCls = "w-full border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white";

  return (
    <tr className="bg-indigo-50/40">
      <td className="px-3 py-2 min-w-[140px]">
        <input autoFocus type="text" value={form.company} onChange={(e) => setField("company", e.target.value)} placeholder="Company" className={inputCls} />
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <input type="text" value={form.role} onChange={(e) => setField("role", e.target.value)} placeholder="Role" className={inputCls} />
      </td>
      <td className="px-3 py-2 min-w-[130px]">
        <select value={form.status} onChange={(e) => setField("status", e.target.value)} className={inputCls}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 min-w-[140px]">
        <input type="date" value={form.date_applied} onChange={(e) => setField("date_applied", e.target.value)} className={inputCls} />
      </td>
      <td className="px-3 py-2 min-w-[100px]">
        <select value={form.job_type} onChange={(e) => setField("job_type", e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
      </td>
      <td className="px-3 py-2 min-w-[130px]">
        <input
          type="text"
          value={form.location}
          onChange={(e) => setField("location", e.target.value)}
          placeholder="City or Remote"
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <div className="flex gap-1">
          <select value={form.salary_type} onChange={(e) => setField("salary_type", e.target.value)} className={`${inputCls} w-24 flex-shrink-0`}>
            <option value="">Type</option>
            {SALARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.long}</option>)}
          </select>
          <input
            type="text"
            value={form.salary_range}
            onChange={(e) => setField("salary_range", e.target.value)}
            placeholder="e.g. $80k–$120k"
            className={`${inputCls} flex-1`}
          />
        </div>
      </td>
      <td className="px-3 py-2 min-w-[130px]">
        <FileSelect
          value={form.resume_id}
          options={resumeOptions}
          placeholder="None"
          nullable={false}
          onChange={(id) => setField("resume_id", id)}
        />
      </td>
      <td className="px-3 py-2 min-w-[130px]">
        <FileSelect
          value={form.cover_letter_id}
          options={coverLetterOptions}
          placeholder="Not required"
          nullable={true}
          onChange={(id) => setField("cover_letter_id", id)}
        />
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="Comments..."
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <input type="url" value={form.url} onChange={(e) => setField("url", e.target.value)} placeholder="https://..." className={inputCls} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !form.company.trim() || !form.role.trim()}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---- Edit form state ----

const EMPTY_FORM = {
  company: "", role: "", url: "", status: "applied",
  date_applied: "", location: "", job_type: "", salary_range: "", salary_type: "", notes: "",
};

// ---- Page ----

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [editJob, setEditJob] = useState<JobApplication | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const [commentJob, setCommentJob] = useState<JobApplication | null>(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchJobs();
    fetchResumes();
  }, []);

  async function fetchJobs() {
    const data = await apiFetch("/jobs");
    setJobs(data);
  }

  async function fetchResumes() {
    const data = await apiFetch("/resumes");
    setResumes(data);
  }

  const resumeOptions = resumes.filter((r) => r.file_type === "resume");
  const coverLetterOptions = resumes.filter((r) => r.file_type === "cover_letter");

  const filtered = statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);

  const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    const s = j.status ?? "applied";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  async function updateField(id: number, patch: Partial<JobApplication>) {
    const updated = await apiFetch(`/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
  }

  async function saveInlineRow(form: InlineForm) {
    const body = {
      company: form.company,
      role: form.role,
      url: form.url || null,
      status: form.status || null,
      date_applied: form.date_applied || null,
      location: form.location || null,
      job_type: form.job_type || null,
      salary_range: form.salary_range || null,
      salary_type: form.salary_type || null,
      notes: form.notes || null,
      resume_id: form.resume_id,
      cover_letter_id: form.cover_letter_id,
    };
    const created = await apiFetch("/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setJobs((prev) => [...prev, created]);
    setAddingRow(false);
  }

  async function handleScrape(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scrapeUrl.trim()) return;
    if (scrapeUrl.includes("linkedin.com")) {
      setScrapeError("LinkedIn blocks automated scraping. Try Indeed, Greenhouse, Lever, or the company's careers page.");
      return;
    }
    setScraping(true);
    setScrapeError(null);
    try {
      const data = await apiFetch("/jobs/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      setForm({
        company: data.company ?? "",
        role: data.role ?? "",
        url: data.url ?? scrapeUrl.trim(),
        status: "applied",
        date_applied: toLocalDate(new Date()),
        location: data.location ?? "",
        job_type: data.job_type ?? "",
        salary_range: data.salary_range ?? "",
        salary_type: "",
        notes: "",
      });
      setShowUrlInput(false);
      setScrapeUrl("");
      setEditJob({ id: -1 } as JobApplication);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Scraping failed");
    } finally {
      setScraping(false);
    }
  }

  function openComment(job: JobApplication) {
    setCommentJob(job);
    setCommentText(job.notes ?? "");
  }

  async function saveComment() {
    if (!commentJob) return;
    setSavingComment(true);
    await updateField(commentJob.id, { notes: commentText || null } as Partial<JobApplication>);
    setSavingComment(false);
    setCommentJob(null);
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openEdit(job: JobApplication) {
    setEditJob(job);
    setForm({
      company: job.company,
      role: job.role,
      url: job.url ?? "",
      status: job.status ?? "applied",
      date_applied: job.date_applied ?? "",
      location: job.location ?? "",
      job_type: job.job_type ?? "",
      salary_range: job.salary_range ?? "",
      salary_type: job.salary_type ?? "",
      notes: job.notes ?? "",
    });
  }

  function closeForm() {
    setEditJob(null);
    setForm(EMPTY_FORM);
  }

  async function saveJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      company: form.company,
      role: form.role,
      url: form.url || null,
      status: form.status || null,
      date_applied: form.date_applied || null,
      location: form.location || null,
      job_type: form.job_type || null,
      salary_range: form.salary_range || null,
      salary_type: form.salary_type || null,
      notes: form.notes || null,
    };
    if (editJob && editJob.id !== -1) {
      const updated = await apiFetch(`/jobs/${editJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setJobs((prev) => prev.map((j) => (j.id === editJob.id ? updated : j)));
    } else {
      const created = await apiFetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, resume_id: null, cover_letter_id: null }),
      });
      setJobs((prev) => [...prev, created]);
    }
    closeForm();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/jobs/${deleteId}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== deleteId));
    setDeleteId(null);
  }

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const activeCount = jobs.filter((j) => j.status === "phone_screen" || j.status === "interview").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Tracker</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={() => { setScrapeUrl(""); setScrapeError(null); setShowUrlInput(true); }}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <Link2 size={15} />
          Add via URL
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            statusFilter === "all" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All <span className="opacity-70">({jobs.length})</span>
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, { label, style }]) => {
          const count = statusCounts[key] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === key ? "bg-indigo-600 text-white" : `${style} hover:opacity-80`
              }`}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
        {activeCount > 0 && (
          <span className="ml-auto text-xs text-slate-500">
            {activeCount} active application{activeCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      {jobs.length === 0 && !addingRow ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-sm mb-3">No applications yet. Add one below or paste a job URL.</p>
          <button
            onClick={() => { setScrapeUrl(""); setScrapeError(null); setShowUrlInput(true); }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Paste a job URL →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full" style={{ minWidth: "1500px" }}>
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  ["Company",      "text-left",   "w-[150px]"],
                  ["Role",         "text-left",   "w-[180px]"],
                  ["Status",       "text-left",   "w-[135px]"],
                  ["Date Applied", "text-left",   "w-[125px]"],
                  ["Type",         "text-left",   "w-[85px]"],
                  ["Location",     "text-left",   "w-[140px]"],
                  ["Salary",       "text-left",   "w-[180px]"],
                  ["Resume",       "text-left",   "w-[140px]"],
                  ["Cover Letter", "text-left",   "w-[140px]"],
                  ["Comments",     "text-left",   "w-[180px]"],
                  ["Link",         "text-center", "w-[55px]"],
                  ["",             "",            "w-[75px]"],
                ].map(([h, align, w], i) => (
                  <th key={i} className={`${align} ${w} text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/60 group transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-slate-900 truncate block max-w-[140px]">{job.company}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700 truncate block max-w-[190px]">{job.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusDropup value={job.status} onChange={(s) => updateField(job.id, { status: s })} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-slate-500">{fmtDate(job.date_applied)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {job.job_type ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${JOB_TYPE_STYLE[job.job_type] ?? "bg-slate-100 text-slate-500"}`}>
                        {job.job_type}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LocationCell
                      value={job.location}
                      onSave={(v) => updateField(job.id, { location: v } as Partial<JobApplication>)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SalaryCell
                      range={job.salary_range}
                      type={job.salary_type}
                      onSave={(range, type) => updateField(job.id, { salary_range: range, salary_type: type } as Partial<JobApplication>)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <FileDropup
                      value={job.resume_id}
                      options={resumeOptions}
                      placeholder="None"
                      nullable={false}
                      onChange={(id) => updateField(job.id, { resume_id: id } as Partial<JobApplication>)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <FileDropup
                      value={job.cover_letter_id}
                      options={coverLetterOptions}
                      placeholder="Not required"
                      nullable={true}
                      onChange={(id) => updateField(job.id, { cover_letter_id: id } as Partial<JobApplication>)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <CommentCell value={job.notes} onEdit={() => openComment(job)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {job.url ? (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Open posting"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(job)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(job.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {addingRow && (
                <InlineAddRow
                  onSave={saveInlineRow}
                  onCancel={() => setAddingRow(false)}
                  resumeOptions={resumeOptions}
                  coverLetterOptions={coverLetterOptions}
                />
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={12} className="px-4 py-2 border-t border-slate-100">
                  {!addingRow && (
                    <button
                      onClick={() => setAddingRow(true)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium"
                    >
                      <Plus size={14} />
                      Add row
                    </button>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {jobs.length === 0 && !addingRow && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setAddingRow(true)}
            className="flex items-center gap-2 border border-dashed border-slate-300 text-slate-500 px-4 py-2 rounded-lg text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <Plus size={15} />
            Add row manually
          </button>
        </div>
      )}

      {/* URL Scrape Modal */}
      {showUrlInput && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Add via Job URL</h2>
            <p className="text-sm text-slate-500 mb-4">Paste the job posting URL and we&apos;ll extract the details automatically.</p>
            <form onSubmit={handleScrape} className="flex flex-col gap-3">
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => { setScrapeUrl(e.target.value); setScrapeError(null); }}
                placeholder="https://..."
                required
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {scrapeError && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{scrapeError}</p>
              )}
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setShowUrlInput(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" disabled={scraping} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60">
                  {scraping ? <><Loader2 size={14} className="animate-spin" /> Scraping...</> : "Scrape →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comment modal */}
      {commentJob !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Comments — {commentJob.company}</h2>
            <p className="text-xs text-slate-400 mb-3">{commentJob.role}</p>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={6}
              autoFocus
              placeholder="Recruiter name, next steps, interview prep, notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
            />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setCommentJob(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
              <button
                onClick={saveComment}
                disabled={savingComment}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {savingComment && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editJob !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editJob.id === -1 ? "New Application" : "Edit Application"}
            </h2>
            <form onSubmit={saveJob} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                  <input type="text" value={form.company} onChange={(e) => setField("company", e.target.value)} required placeholder="e.g. Stripe" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <input type="text" value={form.role} onChange={(e) => setField("role", e.target.value)} required placeholder="e.g. Software Engineer" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job URL</label>
                <input type="url" value={form.url} onChange={(e) => setField("url", e.target.value)} placeholder="https://..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="applied">Applied</option>
                    <option value="phone_screen">Phone Screen</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Applied</label>
                  <input type="date" value={form.date_applied} onChange={(e) => setField("date_applied", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                  <input type="text" value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder="e.g. San Francisco, CA" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Job Type</label>
                  <select value={form.job_type} onChange={(e) => setField("job_type", e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="">—</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salary</label>
                <div className="flex gap-2">
                  <select
                    value={form.salary_type}
                    onChange={(e) => setField("salary_type", e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white w-36 flex-shrink-0"
                  >
                    <option value="">— Type</option>
                    {SALARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.long}</option>)}
                  </select>
                  <input
                    type="text"
                    value={form.salary_range}
                    onChange={(e) => setField("salary_range", e.target.value)}
                    placeholder="e.g. $80k – $120k"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comments</label>
                <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} placeholder="Recruiter name, next steps, interview prep..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  {editJob.id === -1 ? "Save" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete application?</h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this job application.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
