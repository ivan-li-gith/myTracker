"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, ExternalLink, Link2, ChevronDown, Loader2, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { JobApplication } from "@/lib/types";

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
  remote:  "bg-teal-50 text-teal-700",
  hybrid:  "bg-amber-50 text-amber-700",
  onsite:  "bg-slate-100 text-slate-600",
};

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

// ---- Status inline dropdown (opens upward when near bottom) ----

function StatusDropdown({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
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
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 220);
    }
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${cfg.style}`}
      >
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className={`absolute left-0 z-30 w-40 bg-white border border-slate-100 rounded-xl shadow-lg py-1 ${dropUp ? "bottom-8" : "top-8"}`}>
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

// ---- Form state ----

const EMPTY_FORM = {
  company: "",
  role: "",
  url: "",
  status: "applied",
  date_applied: "",
  location: "",
  job_type: "",
  salary_range: "",
  notes: "",
};

// ---- Inline row for adding a new job ----

function InlineAddRow({
  onSave,
  onCancel,
}: {
  onSave: (form: typeof EMPTY_FORM) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, date_applied: toLocalDate(new Date()) });
  const [saving, setSaving] = useState(false);

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
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
      <td className="px-3 py-2">
        <input
          autoFocus
          type="text"
          value={form.company}
          onChange={(e) => setField("company", e.target.value)}
          placeholder="Company"
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.role}
          onChange={(e) => setField("role", e.target.value)}
          placeholder="Role"
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={form.status}
          onChange={(e) => setField("status", e.target.value)}
          className={inputCls}
        >
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          value={form.date_applied}
          onChange={(e) => setField("date_applied", e.target.value)}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={form.job_type}
          onChange={(e) => setField("job_type", e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="url"
          value={form.url}
          onChange={(e) => setField("url", e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
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
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---- Page ----

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [editJob, setEditJob] = useState<JobApplication | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);

  // URL scraping flow
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Edit modal form
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    const data = await apiFetch("/jobs");
    setJobs(data);
  }

  // Status filter
  const filtered =
    statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);

  // Status counts for filter pills
  const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    const s = j.status ?? "applied";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  // ---- Inline status update ----
  async function updateStatus(id: number, status: string) {
    const updated = await apiFetch(`/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
  }

  // ---- Inline row save ----
  async function saveInlineRow(form: typeof EMPTY_FORM) {
    const body = {
      company: form.company,
      role: form.role,
      url: form.url || null,
      status: form.status || null,
      date_applied: form.date_applied || null,
      location: null,
      job_type: form.job_type || null,
      salary_range: null,
      notes: null,
    };
    const created = await apiFetch("/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setJobs((prev) => [created, ...prev]);
    setAddingRow(false);
  }

  // ---- URL scraping ----
  async function handleScrape(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scrapeUrl.trim()) return;
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
        notes: "",
      });
      setShowUrlInput(false);
      setScrapeUrl("");
      setEditJob({ id: -1 } as JobApplication); // open edit modal with scraped data
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Scraping failed");
    } finally {
      setScraping(false);
    }
  }

  // ---- CRUD ----
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
        body: JSON.stringify(body),
      });
      setJobs((prev) => [created, ...prev]);
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

  const activeCount = jobs.filter(
    (j) => j.status === "phone_screen" || j.status === "interview"
  ).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Tracker</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setScrapeUrl(""); setScrapeError(null); setShowUrlInput(true); }}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Link2 size={15} />
            Add via URL
          </button>
        </div>
      </div>

      {/* Summary + filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            statusFilter === "all"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
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
                statusFilter === key
                  ? "bg-indigo-600 text-white"
                  : `${style} hover:opacity-80`
              }`}
            >
              {label}
              <span className="opacity-70">({count})</span>
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
          <p className="text-slate-400 text-sm mb-3">
            No applications yet. Add one below or paste a job URL.
          </p>
          <button
            onClick={() => { setScrapeUrl(""); setScrapeError(null); setShowUrlInput(true); }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Paste a job URL →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  ["Company", "text-left"],
                  ["Role", "text-left"],
                  ["Status", "text-left"],
                  ["Date Applied", "text-left"],
                  ["Type", "text-left"],
                  ["Link", "text-center"],
                  ["", ""],
                ].map(([h, align], i) => (
                  <th
                    key={i}
                    className={`${align} text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3 whitespace-nowrap`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/60 group transition-colors">
                  {/* Company */}
                  <td className="px-3 py-3 max-w-[160px]">
                    <span className="text-sm font-semibold text-slate-900 truncate block">
                      {job.company}
                    </span>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-3 max-w-[200px]">
                    <span className="text-sm text-slate-700 truncate block">{job.role}</span>
                  </td>

                  {/* Status — inline dropdown */}
                  <td className="px-3 py-3">
                    <StatusDropdown
                      value={job.status}
                      onChange={(s) => updateStatus(job.id, s)}
                    />
                  </td>

                  {/* Date Applied */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-sm text-slate-500">{fmtDate(job.date_applied)}</span>
                  </td>

                  {/* Job Type */}
                  <td className="px-3 py-3">
                    {job.job_type ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          JOB_TYPE_STYLE[job.job_type] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {job.job_type}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* Link */}
                  <td className="px-3 py-3 text-center">
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
                    ) : (
                      <span className="text-slate-200">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
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

              {/* Inline add row */}
              {addingRow && (
                <InlineAddRow
                  onSave={saveInlineRow}
                  onCancel={() => setAddingRow(false)}
                />
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="px-3 py-2 border-t border-slate-100">
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

      {/* "+" button when table is empty (no jobs yet) */}
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

      {/* URL Scrape Input Modal */}
      {showUrlInput && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Add via Job URL</h2>
            <p className="text-sm text-slate-500 mb-4">
              Paste the job posting URL and we&apos;ll extract the details automatically.
            </p>
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
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scraping}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {scraping ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    "Scrape →"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (all fields including notes, salary, location) */}
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
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setField("company", e.target.value)}
                    required
                    placeholder="e.g. Stripe"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setField("role", e.target.value)}
                    required
                    placeholder="e.g. Software Engineer"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job URL</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setField("url", e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="applied">Applied</option>
                    <option value="phone_screen">Phone Screen</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Applied</label>
                  <input
                    type="date"
                    value={form.date_applied}
                    onChange={(e) => setField("date_applied", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setField("location", e.target.value)}
                    placeholder="e.g. San Francisco, CA"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Job Type</label>
                  <select
                    value={form.job_type}
                    onChange={(e) => setField("job_type", e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">—</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salary Range</label>
                <input
                  type="text"
                  value={form.salary_range}
                  onChange={(e) => setField("salary_range", e.target.value)}
                  placeholder="e.g. $120k – $160k"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={3}
                  placeholder="Recruiter name, next steps, interview prep..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
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
            <p className="text-sm text-slate-500 mb-5">
              This will permanently remove this job application.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
