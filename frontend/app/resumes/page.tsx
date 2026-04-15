"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Download, FileText, FileBadge, Loader2, Plus } from "lucide-react";
import { apiFetch, apiFetchRaw } from "@/lib/api";
import { Resume } from "@/lib/types";

const FILE_TYPE_CONFIG = {
  resume: { label: "Resume", style: "bg-indigo-100 text-indigo-700", icon: FileText },
  cover_letter: { label: "Cover Letter", style: "bg-violet-100 text-violet-700", icon: FileBadge },
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<"resume" | "cover_letter">("resume");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchResumes(); }, []);

  async function fetchResumes() {
    const data = await apiFetch("/resumes");
    setResumes(data);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("file_type", fileType);
      form.append("file", file);
      const created = await apiFetch("/resumes", { method: "POST", body: form });
      setResumes((prev) => [created, ...prev]);
      setShowForm(false);
      setName("");
      setFileType("resume");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(resume: Resume) {
    setDownloading(resume.id);
    try {
      const res = await apiFetchRaw(`/resumes/${resume.id}/download`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resume.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — user will notice the download didn't happen
    } finally {
      setDownloading(null);
    }
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/resumes/${deleteId}`, { method: "DELETE" });
    setResumes((prev) => prev.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  }

  const grouped = {
    resume: resumes.filter((r) => r.file_type === "resume"),
    cover_letter: resumes.filter((r) => r.file_type === "cover_letter"),
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resumes & Cover Letters</h1>
          <p className="text-sm text-slate-400 mt-0.5">Upload files to attach them to job applications.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setUploadError(null); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} />
          Upload file
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Upload new file</h2>
          <form onSubmit={handleUpload} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Software Engineer Resume 2026"
                required
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as "resume" | "cover_letter")}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="resume">Resume</option>
                <option value="cover_letter">Cover Letter</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors"
              />
              <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, or TXT</p>
            </div>
            {uploadError && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !file || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Upload</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* File lists */}
      {resumes.length === 0 && !showForm ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-sm mb-3">No files uploaded yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Upload your first file →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {(["resume", "cover_letter"] as const).map((type) => {
            const list = grouped[type];
            const cfg = FILE_TYPE_CONFIG[type];
            const Icon = cfg.icon;
            if (list.length === 0) return null;
            return (
              <div key={type}>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{cfg.label}s</h2>
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                  <ul className="divide-y divide-slate-50">
                    {list.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors group">
                        <div className={`p-1.5 rounded-lg ${cfg.style}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                          <p className="text-xs text-slate-400">{r.filename} · {fmtDate(r.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDownload(r)}
                            disabled={downloading === r.id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Download"
                          >
                            {downloading === r.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          </button>
                          <button
                            onClick={() => setDeleteId(r.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete file?</h2>
            <p className="text-sm text-slate-500 mb-5">
              This will permanently remove the file. Any jobs referencing it will lose the link.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
