"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Pencil, Trash2, ExternalLink, ChevronDown, ChevronRight,
  Loader2, MessageSquare, Download, ArrowUp, ArrowDown, ArrowUpDown,
  FileText, FileBadge, Upload, X,
} from "lucide-react";
import { apiFetch, apiFetchRaw } from "@/lib/api";
import { JobApplication, Resume } from "@/lib/types";

// --- Constants ---

type StatusKey = "applied" | "phone_screen" | "interview" | "offer" | "rejected";

const STATUS_CONFIG: Record<StatusKey, { label: string; style: string }> = {
  applied:      { label: "Applied",      style: "bg-blue-500/20 text-blue-300" },
  phone_screen: { label: "Phone Screen", style: "bg-amber-500/20 text-amber-300" },
  interview:    { label: "Interview",    style: "bg-violet-500/20 text-violet-300" },
  offer:        { label: "Offer",        style: "bg-emerald-500/20 text-emerald-300" },
  rejected:     { label: "Rejected",     style: "bg-red-500/20 text-red-400" },
};

const SALARY_TYPES = [
  { value: "hourly",  label: "/ hr", long: "Per Hour" },
  { value: "weekly",  label: "/ wk", long: "Per Week" },
  { value: "monthly", label: "/ mo", long: "Per Month" },
  { value: "yearly",  label: "/ yr", long: "Per Year" },
];

type SortCol = "company" | "role" | "status" | "date_applied" | "job_type" | "location" | "salary_range" | "resume_id" | "cover_letter_id" | "notes";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  applied: 0, phone_screen: 1, interview: 2, offer: 3, rejected: 4,
};

const EMPTY_FORM = {
  company: "", role: "", url: "", status: "applied",
  date_applied: "", location: "", job_type: "",
  salary_low: "", salary_high: "", salary_type: "",
  notes: "",
  resume_id: null as number | null,
  cover_letter_id: null as number | null,
};

const INPUT_CLS = "w-full px-3 py-2 bg-[#14162e] border border-white/[0.1] rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors text-sm";

// --- Utilities ---

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

async function downloadBlob(url: string, filename: string) {
  const res = await apiFetchRaw(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function getDropDirection(el: HTMLElement, needed = 220): "up" | "down" {
  const rect = el.getBoundingClientRect();
  return window.innerHeight - rect.bottom < needed ? "up" : "down";
}

function getStatusConfig(s: string | null) {
  return STATUS_CONFIG[s as StatusKey] ?? { label: s ?? "—", style: "bg-white/[0.07] text-slate-400" };
}

function salaryTypeLabel(type: string | null) {
  return SALARY_TYPES.find((t) => t.value === type)?.label ?? null;
}

function extractVersion(name: string): number {
  const m = name.match(/v(\d+)/i);
  return m ? parseInt(m[1]) : 0;
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseSalaryRange(range: string | null): { low: string; high: string } {
  if (!range) return { low: "", high: "" };
  const parts = range.split("-");
  return { low: parts[0] ?? "", high: parts[1] ?? "" };
}

function buildSalaryRange(low: string, high: string): string | null {
  const l = low.trim();
  if (!l) return null;
  const h = high.trim();
  return h ? `${l}-${h}` : l;
}

function formatSalaryDisplay(range: string | null, type: string | null): string | null {
  if (!range) return null;
  const typeLabel = salaryTypeLabel(type);
  const useK = type === "monthly" || type === "yearly";
  const parts = range.split("-");
  const fmt = (v: string) => { const c = v.replace(/^\$/, ""); return useK ? `$${c}K` : `$${c}`; };
  const display = parts.length > 1 ? `${fmt(parts[0])} – ${fmt(parts[1])}` : fmt(parts[0]);
  return typeLabel ? `${display} ${typeLabel}` : display;
}

function applySorting(jobs: JobApplication[], col: SortCol | null, dir: SortDir, resumes: Resume[]): JobApplication[] {
  if (!col) return jobs;
  const mult = dir === "asc" ? 1 : -1;
  return [...jobs].sort((a, b) => {
    let av: string | number, bv: string | number;
    if (col === "status") {
      av = STATUS_ORDER[a.status ?? ""] ?? 99;
      bv = STATUS_ORDER[b.status ?? ""] ?? 99;
    } else if (col === "resume_id") {
      av = resumes.find((r) => r.id === a.resume_id)?.name ?? "";
      bv = resumes.find((r) => r.id === b.resume_id)?.name ?? "";
    } else if (col === "cover_letter_id") {
      av = resumes.find((r) => r.id === a.cover_letter_id)?.name ?? "";
      bv = resumes.find((r) => r.id === b.cover_letter_id)?.name ?? "";
    } else {
      av = (a[col] as string | null) ?? "";
      bv = (b[col] as string | null) ?? "";
    }
    if (av === "" && bv !== "") return 1;
    if (bv === "" && av !== "") return -1;
    if (av < bv) return -1 * mult;
    if (av > bv) return mult;
    return 0;
  });
}

// --- Sub-components ---

function StatusDropup({ value, onChange }: { value: string | null; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");
  const ref = useRef<HTMLDivElement>(null);
  const cfg = getStatusConfig(value);

  useClickOutside(ref, () => setOpen(false));

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && ref.current) setDir(getDropDirection(ref.current, 220));
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
        <div className={`absolute left-0 z-30 w-40 bg-[#1e2245] border border-white/[0.1] rounded-xl shadow-xl py-1 ${dir === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {Object.entries(STATUS_CONFIG).map(([key, { label, style }]) => (
            <button
              key={key}
              onClick={(e) => { e.stopPropagation(); onChange(key); setOpen(false); }}
              className="flex items-center w-full px-3 py-2 hover:bg-white/[0.06] transition-colors"
            >
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FileDropup({
  value,
  options,
  placeholder,
  nullable,
  onChange,
  onOpenResumes,
}: {
  value: number | null;
  options: Resume[];
  placeholder: string;
  nullable: boolean;
  onChange: (id: number | null) => void;
  onOpenResumes?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [downloading, setDownloading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((r) => r.id === value) ?? null;

  useClickOutside(ref, () => setOpen(false));

  if (options.length === 0) {
    return (
      <span className="text-xs text-slate-500 whitespace-nowrap">
        <button onClick={onOpenResumes} className="text-indigo-400 hover:text-indigo-300 transition-colors">Add files</button> first
      </span>
    );
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!selected) return;
    setDownloading(true);
    try { await downloadBlob(`/resumes/${selected.id}/download`, selected.filename); } finally { setDownloading(false); }
  }

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && ref.current) setDir(getDropDirection(ref.current, 230));
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 min-w-0">
      {selected ? (
        <>
          <button
            onClick={handleDownload}
            disabled={downloading}
            title={`Download ${selected.name}`}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 truncate max-w-[160px] text-left leading-snug transition-colors"
          >
            {downloading ? <Loader2 size={13} className="animate-spin inline" /> : selected.name}
          </button>
          <button
            onClick={handleOpen}
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
          >
            <ChevronDown size={12} />
          </button>
        </>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span>{placeholder}</span>
          <ChevronDown size={12} />
        </button>
      )}

      {open && (
        <div className={`absolute left-0 z-30 w-52 bg-[#1e2245] border border-white/[0.1] rounded-xl shadow-xl py-1 max-h-52 overflow-y-auto ${dir === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {nullable && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
              className="flex items-center w-full px-3 py-2 hover:bg-white/[0.06] transition-colors text-xs text-slate-500"
            >
              — Not required
            </button>
          )}
          {!nullable && value !== null && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
              className="flex items-center w-full px-3 py-2 hover:bg-white/[0.06] transition-colors text-xs text-slate-500"
            >
              — None
            </button>
          )}
          {options.map((r) => (
            <button
              key={r.id}
              onClick={(e) => { e.stopPropagation(); onChange(r.id); setOpen(false); }}
              className={`flex items-center w-full px-3 py-2 hover:bg-white/[0.06] transition-colors text-xs text-left gap-2 ${
                r.id === value ? "font-semibold text-indigo-400" : "text-slate-300"
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
        className="w-[120px] border-b border-indigo-400/60 bg-transparent text-sm text-slate-200 focus:outline-none py-0.5"
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setText(value ?? ""); setEditing(true); }}
      className="text-sm font-medium text-slate-200 hover:text-white text-left leading-snug transition-colors"
      title={value ?? "Click to set location"}
    >
      {value ?? <span className="text-slate-500 font-normal">Add location</span>}
    </button>
  );
}

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
  const [editType, setEditType] = useState(type ?? "");
  const [editLow, setEditLow] = useState(() => parseSalaryRange(range).low);
  const [editHigh, setEditHigh] = useState(() => parseSalaryRange(range).high);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));

  function openEditor(e: React.MouseEvent) {
    e.stopPropagation();
    const parsed = parseSalaryRange(range);
    setEditType(type ?? "");
    setEditLow(parsed.low);
    setEditHigh(parsed.high);
    if (!open && ref.current) setDir(getDropDirection(ref.current, 240));
    setOpen((o) => !o);
  }

  function save() {
    setOpen(false);
    onSave(buildSalaryRange(editLow, editHigh), editType || null);
  }

  const useK = editType === "monthly" || editType === "yearly";
  const placeholder = useK ? "e.g. 80" : "e.g. 25";
  const suffix = useK ? "K" : "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openEditor}
        className="text-sm font-medium text-slate-200 hover:text-white text-left leading-snug transition-colors"
      >
        {range
          ? <span>{formatSalaryDisplay(range, type)}</span>
          : <span className="text-slate-500 font-normal">Add salary</span>
        }
      </button>

      {open && (
        <div className={`absolute left-0 z-30 w-64 bg-[#1e2245] border border-white/[0.1] rounded-xl shadow-xl p-3 flex flex-col gap-2 ${dir === "up" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Type</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">— Select type</option>
              {SALARY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.long}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                Low{suffix && ` (${suffix})`}
              </label>
              <input
                autoFocus
                type="number"
                value={editLow}
                onChange={(e) => setEditLow(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={placeholder}
                className={INPUT_CLS}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                High{suffix && ` (${suffix})`} <span className="text-slate-600 normal-case font-normal">optional</span>
              </label>
              <input
                type="number"
                value={editHigh}
                onChange={(e) => setEditHigh(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={placeholder}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
            <button onClick={save} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-500 transition-colors">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Page ---

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortCol, setSortCol] = useState<SortCol | null>("date_applied");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [editJob, setEditJob] = useState<JobApplication | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [commentJob, setCommentJob] = useState<JobApplication | null>(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const [showResumesPanel, setShowResumesPanel] = useState(false);
  const [downloadingResumeId, setDownloadingResumeId] = useState<number | null>(null);
  const [deleteResumeId, setDeleteResumeId] = useState<number | null>(null);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [resumeUploadName, setResumeUploadName] = useState("");
  const [resumeUploadType, setResumeUploadType] = useState<"resume" | "cover_letter">("resume");
  const [resumeUploadFile, setResumeUploadFile] = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const resumeFileRef = useRef<HTMLInputElement>(null);

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

  const filtered = applySorting(
    statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter),
    sortCol, sortDir, resumes,
  );

  type JobDateGroup = { date: string; label: string; items: JobApplication[] };
  const jobDateGroups: JobDateGroup[] = [];
  for (const job of filtered) {
    const date = job.date_applied ?? "no-date";
    let group = jobDateGroups.find((g) => g.date === date);
    if (!group) {
      let label: string;
      if (date === "no-date") {
        label = "No Date";
      } else {
        const [y, m, d] = date.split("-").map(Number);
        label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", year: "numeric",
        });
      }
      group = { date, label, items: [] };
      jobDateGroups.push(group);
    }
    group.items.push(job);
  }

  const STATUS_SUMMARY_ORDER = ["applied", "phone_screen", "interview", "offer", "rejected"] as const;

  const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    const s = j.status ?? "applied";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const activeCount = jobs.filter((j) => j.status === "phone_screen" || j.status === "interview").length;
  const concludedCount = (statusCounts.offer ?? 0) + (statusCounts.rejected ?? 0);
  const successRate = concludedCount > 0 ? Math.round(((statusCounts.offer ?? 0) / concludedCount) * 100) : null;
  const responseRate = jobs.length > 0
    ? Math.round(((jobs.length - (statusCounts.applied ?? 0)) / jobs.length) * 100)
    : null;

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  // --- Handlers ---

  function toggleRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  async function updateField(id: number, patch: Partial<JobApplication>) {
    const updated = await apiFetch(`/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNewJob() {
    const latestResume = [...resumeOptions].sort((a, b) => extractVersion(b.name) - extractVersion(a.name))[0] ?? null;
    setForm({ ...EMPTY_FORM, date_applied: toLocalDate(new Date()), resume_id: latestResume?.id ?? null });
    setEditJob({ id: -1 } as JobApplication);
  }

  function openEdit(job: JobApplication) {
    setEditJob(job);
    const { low, high } = parseSalaryRange(job.salary_range);
    setForm({
      company: job.company,
      role: job.role,
      url: job.url ?? "",
      status: job.status ?? "applied",
      date_applied: job.date_applied ?? "",
      location: job.location ?? "",
      job_type: job.job_type ?? "",
      salary_low: low,
      salary_high: high,
      salary_type: job.salary_type ?? "",
      notes: job.notes ?? "",
      resume_id: job.resume_id ?? null,
      cover_letter_id: job.cover_letter_id ?? null,
    });
  }

  function closeForm() {
    setEditJob(null);
    setForm(EMPTY_FORM);
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

  async function persistJob() {
    const body = {
      company: form.company,
      role: form.role,
      url: form.url || null,
      status: form.status || null,
      date_applied: form.date_applied || null,
      location: form.location || null,
      job_type: form.job_type || null,
      salary_range: buildSalaryRange(form.salary_low, form.salary_high),
      salary_type: form.salary_type || null,
      notes: form.notes || null,
      resume_id: form.resume_id,
      cover_letter_id: form.cover_letter_id,
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
        body: JSON.stringify(body),
      });
      setJobs((prev) => [created, ...prev]);
    }
  }

  async function saveJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await persistJob();
    closeForm();
  }

  async function saveJobAndAddAnother() {
    await persistJob();
    const latestResume = [...resumeOptions].sort((a, b) => extractVersion(b.name) - extractVersion(a.name))[0] ?? null;
    setForm({ ...EMPTY_FORM, date_applied: form.date_applied, status: form.status, resume_id: latestResume?.id ?? null });
    setEditJob({ id: -1 } as JobApplication);
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/jobs/${deleteId}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== deleteId));
    setDeleteId(null);
  }

  async function handleResumeDownload(resume: Resume) {
    setDownloadingResumeId(resume.id);
    try {
      await downloadBlob(`/resumes/${resume.id}/download`, resume.filename);
    } catch { /* silent */ } finally {
      setDownloadingResumeId(null);
    }
  }

  async function handleResumeUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!resumeUploadFile || !resumeUploadName.trim()) return;
    setResumeUploading(true);
    setResumeUploadError(null);
    try {
      const formData = new FormData();
      formData.append("name", resumeUploadName.trim());
      formData.append("file_type", resumeUploadType);
      formData.append("file", resumeUploadFile);
      const created = await apiFetch("/resumes", { method: "POST", body: formData });
      setResumes((prev) => [created, ...prev]);
      setShowResumeUpload(false);
      setResumeUploadName("");
      setResumeUploadType("resume");
      setResumeUploadFile(null);
      if (resumeFileRef.current) resumeFileRef.current.value = "";
    } catch {
      setResumeUploadError("Upload failed. Please try again.");
    } finally {
      setResumeUploading(false);
    }
  }

  async function confirmResumeDelete() {
    if (deleteResumeId === null) return;
    await apiFetch(`/resumes/${deleteResumeId}`, { method: "DELETE" });
    setResumes((prev) => prev.filter((r) => r.id !== deleteResumeId));
    setDeleteResumeId(null);
  }

  // --- Render ---

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Job Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResumesPanel(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-400 border border-white/[0.1] rounded-lg hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
          >
            <FileText size={14} />
            Resumes
          </button>
          <button
            onClick={openNewJob}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors active:scale-95"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#1e2245] border border-white/[0.07] rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total Applied</p>
            <p className="text-2xl font-bold text-white mt-1">{jobs.length}</p>
          </div>
          <div className="bg-[#1e2245] border border-white/[0.07] rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Active</p>
            <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">phone screen + interview</p>
          </div>
          <div className="bg-[#1e2245] border border-white/[0.07] rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Success Rate</p>
            <p className="text-2xl font-bold text-white mt-1">{successRate !== null ? `${successRate}%` : "—"}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {concludedCount > 0 ? `${statusCounts.offer ?? 0} offer${(statusCounts.offer ?? 0) !== 1 ? "s" : ""} / ${concludedCount} concluded` : "No concluded apps"}
            </p>
          </div>
          <div className="bg-[#1e2245] border border-white/[0.07] rounded-2xl px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Response Rate</p>
            <p className="text-2xl font-bold text-white mt-1">{responseRate !== null ? `${responseRate}%` : "—"}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {jobs.length > 0 ? `${jobs.length - (statusCounts.applied ?? 0)} responded` : "No responses yet"}
            </p>
          </div>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            statusFilter === "all"
              ? "bg-indigo-600 text-white"
              : "bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:bg-white/[0.09]"
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
        <button
          onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
          className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {sortDir === "desc" ? <><ArrowDown size={12} /> Newest first</> : <><ArrowUp size={12} /> Oldest first</>}
        </button>
      </div>

      {/* Applications table */}
      {jobs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 text-sm mb-3">No applications yet.</p>
          <button onClick={openNewJob} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Add your first application →
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] p-10 text-center">
          <p className="text-slate-500 text-sm">No applications match the selected filter.</p>
          <button onClick={() => setStatusFilter("all")} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Clear filter</button>
        </div>
      ) : (
        <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="w-10" />
                {(["company", "role", "status", "location", "salary_range"] as const).map((col) => {
                  const labels: Record<string, string> = { company: "Company", role: "Role", status: "Status", location: "Location", salary_range: "Salary" };
                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap cursor-pointer hover:text-slate-300 select-none transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {labels[col]}
                        {sortCol === col
                          ? sortDir === "asc" ? <ArrowUp size={11} className="text-indigo-400" /> : <ArrowDown size={11} className="text-indigo-400" />
                          : <ArrowUpDown size={11} className="opacity-25" />}
                      </span>
                    </th>
                  );
                })}
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {jobDateGroups.map((group) => {
                const groupStatuses = new Map<string, number>();
                for (const job of group.items) groupStatuses.set(job.status ?? "applied", (groupStatuses.get(job.status ?? "applied") ?? 0) + 1);
                const statusSummary = STATUS_SUMMARY_ORDER
                  .filter((s) => groupStatuses.has(s))
                  .map((s) => `${groupStatuses.get(s)} ${STATUS_CONFIG[s].label}`)
                  .join(" · ");

                return (
                  <React.Fragment key={group.date}>
                    {/* Date separator row */}
                    <tr className="bg-white/[0.03] border-b border-white/[0.06] sticky top-0 z-10">
                      <td colSpan={7} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.label}</span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span>{group.items.length} applied</span>
                            {statusSummary && <><span>·</span><span>{statusSummary}</span></>}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {group.items.map((job) => {
                      const expanded = expandedRows.has(job.id);
                      return (
                        <React.Fragment key={job.id}>
                          <tr
                            onClick={() => toggleRow(job.id)}
                            className={`cursor-pointer group transition-colors border-b border-white/[0.04] ${expanded ? "bg-white/[0.03]" : "hover:bg-white/[0.04]"}`}
                          >
                            <td className="px-4 py-4 w-10">
                              <ChevronRight size={15} className={`text-slate-500 transition-transform duration-150 ${expanded ? "rotate-90 text-indigo-400" : ""}`} />
                            </td>
                            <td className="px-4 py-4">
                              {job.url ? (
                                <a
                                  href={job.url} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="group/link inline-flex items-center gap-1 text-sm font-semibold text-slate-200 hover:text-indigo-400 transition-colors"
                                >
                                  {job.company}
                                  <ExternalLink size={11} className="opacity-0 group-hover/link:opacity-60 transition-opacity" />
                                </a>
                              ) : (
                                <span className="text-sm font-semibold text-slate-200">{job.company}</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-slate-400">{job.role}</span>
                            </td>
                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                              <StatusDropup value={job.status} onChange={(s) => updateField(job.id, { status: s })} />
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-slate-500">{job.location ?? <span className="text-slate-600">—</span>}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-sm text-slate-500">
                                {formatSalaryDisplay(job.salary_range, job.salary_type) ?? <span className="text-slate-600">—</span>}
                              </span>
                            </td>
                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openEdit(job)} className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-all">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => setDeleteId(job.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {expanded && (
                            <tr className="border-b border-white/[0.04]">
                              <td colSpan={7} className="px-8 py-5 bg-[#14162e]/60">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  {[
                                    { label: "Location", content: <LocationCell value={job.location} onSave={(v) => updateField(job.id, { location: v } as Partial<JobApplication>)} /> },
                                    { label: "Salary", content: <SalaryCell range={job.salary_range} type={job.salary_type} onSave={(range, type) => updateField(job.id, { salary_range: range, salary_type: type } as Partial<JobApplication>)} /> },
                                    { label: "Resume", content: <FileDropup value={job.resume_id} options={resumeOptions} placeholder="None" nullable={false} onChange={(id) => updateField(job.id, { resume_id: id } as Partial<JobApplication>)} onOpenResumes={() => setShowResumesPanel(true)} /> },
                                    { label: "Cover Letter", content: <FileDropup value={job.cover_letter_id} options={coverLetterOptions} placeholder="Not required" nullable={true} onChange={(id) => updateField(job.id, { cover_letter_id: id } as Partial<JobApplication>)} onOpenResumes={() => setShowResumesPanel(true)} /> },
                                  ].map(({ label, content }) => (
                                    <div key={label} className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
                                      <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase mb-2">{label}</p>
                                      {content}
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-[#1e2245] rounded-2xl border border-white/[0.07] px-5 py-4">
                                  <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase mb-2">Notes</p>
                                  <button onClick={() => openComment(job)} className="text-left w-full group/notes">
                                    {job.notes ? (
                                      <p className="text-sm text-slate-300 leading-relaxed group-hover/notes:text-slate-200 transition-colors whitespace-pre-wrap">{job.notes}</p>
                                    ) : (
                                      <p className="text-sm text-slate-500 group-hover/notes:text-slate-400 transition-colors flex items-center gap-2">
                                        <MessageSquare size={15} /> Add a note...
                                      </p>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Comments modal */}
      {commentJob !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCommentJob(null)} />
          <div className="relative bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-white mb-1">Notes — {commentJob.company}</h2>
            <p className="text-xs text-slate-500 mb-3">{commentJob.role}</p>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={6}
              autoFocus
              placeholder="Recruiter name, next steps, interview prep, notes..."
              className={`${INPUT_CLS} resize-none leading-relaxed`}
            />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setCommentJob(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button
                onClick={saveComment}
                disabled={savingComment}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-60"
              >
                {savingComment && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / New Application modal */}
      {editJob !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">
              {editJob.id === -1 ? "New Application" : "Edit Application"}
            </h2>
            <form onSubmit={saveJob} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Company</label>
                  <input type="text" value={form.company} onChange={(e) => setField("company", e.target.value)} required placeholder="e.g. Stripe" className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                  <input type="text" value={form.role} onChange={(e) => setField("role", e.target.value)} required placeholder="e.g. Software Engineer" className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Job URL</label>
                <input type="url" value={form.url} onChange={(e) => setField("url", e.target.value)} placeholder="https://..." className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)} className={INPUT_CLS}>
                    <option value="applied">Applied</option>
                    <option value="phone_screen">Phone Screen</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Date Applied</label>
                  <input type="date" value={form.date_applied} onChange={(e) => setField("date_applied", e.target.value)} className={INPUT_CLS} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
                  <input type="text" value={form.location} onChange={(e) => setField("location", e.target.value)} placeholder="e.g. San Francisco, CA" className={INPUT_CLS} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Job Type</label>
                  <select value={form.job_type} onChange={(e) => setField("job_type", e.target.value)} className={INPUT_CLS}>
                    <option value="">—</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Salary</label>
                <div className="flex flex-col gap-2">
                  <select
                    value={form.salary_type}
                    onChange={(e) => setField("salary_type", e.target.value)}
                    className={INPUT_CLS}
                  >
                    <option value="">— Type</option>
                    {SALARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.long}</option>)}
                  </select>
                  {form.salary_type && (() => {
                    const useK = form.salary_type === "monthly" || form.salary_type === "yearly";
                    const suffix = useK ? " (K)" : "";
                    const ph = useK ? "e.g. 80" : "e.g. 25";
                    return (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-500 mb-1">Low{suffix}</label>
                          <input type="number" value={form.salary_low} onChange={(e) => setField("salary_low", e.target.value)} placeholder={ph} className={INPUT_CLS} />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-slate-500 mb-1">High{suffix} <span className="text-slate-600">optional</span></label>
                          <input type="number" value={form.salary_high} onChange={(e) => setField("salary_high", e.target.value)} placeholder={ph} className={INPUT_CLS} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Resume</label>
                  {resumeOptions.length === 0 ? (
                    <p className="text-xs text-slate-500 pt-1">
                      <button type="button" onClick={() => setShowResumesPanel(true)} className="text-indigo-400 hover:text-indigo-300 transition-colors">Upload a resume</button> first
                    </p>
                  ) : (
                    <select
                      value={form.resume_id ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, resume_id: e.target.value ? Number(e.target.value) : null }))}
                      className={INPUT_CLS}
                    >
                      <option value="">— None</option>
                      {resumeOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Cover Letter</label>
                  {coverLetterOptions.length === 0 ? (
                    <p className="text-xs text-slate-500 pt-1">
                      <button type="button" onClick={() => setShowResumesPanel(true)} className="text-indigo-400 hover:text-indigo-300 transition-colors">Upload a cover letter</button> first
                    </p>
                  ) : (
                    <select
                      value={form.cover_letter_id ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, cover_letter_id: e.target.value ? Number(e.target.value) : null }))}
                      className={INPUT_CLS}
                    >
                      <option value="">— Not required</option>
                      {coverLetterOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={3} placeholder="Recruiter name, next steps, interview prep..." className={`${INPUT_CLS} resize-none`} />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                {editJob.id === -1 && (
                  <button
                    type="button"
                    onClick={saveJobAndAddAnother}
                    className="px-4 py-2 text-sm border border-white/[0.1] text-slate-300 rounded-lg hover:bg-white/[0.06] transition-colors"
                  >
                    Save & add another
                  </button>
                )}
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
                  {editJob.id === -1 ? "Save" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-white mb-1">Delete application?</h2>
            <p className="text-sm text-slate-400 mb-5">This will permanently remove this job application.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Resumes & Cover Letters panel */}
      {showResumesPanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowResumesPanel(false); setShowResumeUpload(false); }} />
          <div className="relative bg-[#1e2245] border border-white/[0.08] w-full sm:rounded-2xl sm:max-w-2xl shadow-2xl flex flex-col max-h-[90dvh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
              <div>
                <h2 className="text-base font-bold text-white">Resumes & Cover Letters</h2>
                <p className="text-xs text-slate-500 mt-0.5">{resumes.length} file{resumes.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowResumeUpload((v) => !v); setResumeUploadError(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  <Upload size={13} /> Upload
                </button>
                <button
                  onClick={() => { setShowResumesPanel(false); setShowResumeUpload(false); }}
                  className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {showResumeUpload && (
              <div className="px-6 py-4 border-b border-white/[0.07] bg-[#14162e]/60">
                <form onSubmit={handleResumeUpload} className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
                      <input
                        type="text"
                        value={resumeUploadName}
                        onChange={(e) => setResumeUploadName(e.target.value)}
                        placeholder="e.g. Software Engineer Resume 2026"
                        required
                        autoFocus
                        className={INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                      <select
                        value={resumeUploadType}
                        onChange={(e) => setResumeUploadType(e.target.value as "resume" | "cover_letter")}
                        className={INPUT_CLS}
                      >
                        <option value="resume">Resume</option>
                        <option value="cover_letter">Cover Letter</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">File</label>
                    <input
                      ref={resumeFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      required
                      onChange={(e) => setResumeUploadFile(e.target.files?.[0] ?? null)}
                      className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30 cursor-pointer"
                    />
                    <p className="text-xs text-slate-600 mt-1">PDF, DOC, DOCX, or TXT</p>
                  </div>
                  {resumeUploadError && (
                    <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{resumeUploadError}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowResumeUpload(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                    <button
                      type="submit"
                      disabled={resumeUploading || !resumeUploadFile || !resumeUploadName.trim()}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-60"
                    >
                      {resumeUploading ? <><Loader2 size={13} className="animate-spin" /> Uploading...</> : <><Upload size={13} /> Upload</>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {resumes.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-slate-500 text-sm mb-3">No files uploaded yet.</p>
                  <button onClick={() => setShowResumeUpload(true)} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                    Upload your first file →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {(["resume", "cover_letter"] as const).map((type) => {
                    const list = resumes.filter((r) => r.file_type === type);
                    if (list.length === 0) return null;
                    const isResume = type === "resume";
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-2">
                          {isResume
                            ? <FileText size={13} className="text-indigo-400" />
                            : <FileBadge size={13} className="text-violet-400" />}
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {isResume ? "Resumes" : "Cover Letters"}
                          </span>
                        </div>
                        <div className="bg-[#14162e] border border-white/[0.07] rounded-xl overflow-hidden">
                          <ul className="divide-y divide-white/[0.05]">
                            {list.map((r) => (
                              <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
                                <div className={`p-1.5 rounded-lg shrink-0 ${isResume ? "bg-indigo-500/20 text-indigo-400" : "bg-violet-500/20 text-violet-400"}`}>
                                  {isResume ? <FileText size={13} /> : <FileBadge size={13} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-200 truncate">{r.name}</p>
                                  <p className="text-xs text-slate-500">{r.filename} · {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleResumeDownload(r)}
                                    disabled={downloadingResumeId === r.id}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                    title="Download"
                                  >
                                    {downloadingResumeId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                  </button>
                                  <button
                                    onClick={() => setDeleteResumeId(r.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resume delete confirmation */}
      {deleteResumeId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteResumeId(null)} />
          <div className="relative bg-[#1e2245] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-white mb-1">Delete file?</h2>
            <p className="text-sm text-slate-400 mb-5">This will permanently remove the file. Any jobs referencing it will lose the link.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteResumeId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button onClick={confirmResumeDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
