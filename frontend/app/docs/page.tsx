"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Star, Pencil, Trash2, X, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Doc } from "@/lib/types";

// ---- YouTube embed helper ----

function extractYouTubeId(text: string): string | null {
  const m = text.trim().match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            const text = Array.isArray(children)
              ? children.map((c) => (typeof c === "string" ? c : "")).join("")
              : typeof children === "string"
              ? children
              : "";
            const ytId = extractYouTubeId(text);
            if (ytId) {
              return (
                <div className="my-4" style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}`}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                    className="rounded-xl"
                    allowFullScreen
                    title="YouTube video"
                  />
                </div>
              );
            }
            return <p>{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ---- Form state ----

const EMPTY_FORM = { title: "", category: "", content: "" };

// ---- Page ----

export default function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [favFilter, setFavFilter] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchDocs();
  }, []);

  async function fetchDocs() {
    const data = await apiFetch("/docs");
    setDocs(data);
  }

  // Derived data
  const categories = [...new Set(docs.map((d) => d.category).filter(Boolean))] as string[];

  const visibleDocs = docs.filter((d) => {
    if (favFilter && !d.is_favorite) return false;
    if (selectedCategory && d.category !== selectedCategory) return false;
    return true;
  });

  const catCount = (cat: string) => docs.filter((d) => d.category === cat).length;

  // Keep selectedDoc in sync after updates
  function syncSelected(updated: Doc) {
    setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    if (selectedDoc?.id === updated.id) setSelectedDoc(updated);
  }

  // ---- Favorite toggle ----
  async function toggleFavorite(id: number) {
    const updated = await apiFetch(`/docs/${id}/favorite`, { method: "PATCH" });
    syncSelected(updated);
  }

  // ---- CRUD ----
  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  }

  function openEdit(doc: Doc) {
    setEditDoc(doc);
    setForm({ title: doc.title, category: doc.category ?? "", content: doc.content ?? "" });
  }

  function closeForm() {
    setShowAddModal(false);
    setEditDoc(null);
    setForm(EMPTY_FORM);
  }

  async function saveDoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = {
      title: form.title,
      category: form.category || null,
      content: form.content || null,
    };

    if (editDoc) {
      const updated = await apiFetch(`/docs/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      syncSelected(updated);
    } else {
      const created = await apiFetch("/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDocs((prev) => [created, ...prev]);
    }
    closeForm();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await apiFetch(`/docs/${deleteId}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== deleteId));
    if (selectedDoc?.id === deleteId) setSelectedDoc(null);
    setDeleteId(null);
  }

  // Existing categories for datalist
  const datalistId = "doc-categories";

  return (
    <div className="flex">
      {/* Left panel */}
      <aside className="w-52 shrink-0 border-r border-slate-100 min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <button
            onClick={openAdd}
            className="flex items-center gap-2 w-full bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors justify-center"
          >
            <Plus size={15} />
            Add Guide
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-slate-100 flex gap-1">
          <button
            onClick={() => setFavFilter(false)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              !favFilter ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFavFilter(true)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${
              favFilter ? "bg-amber-50 text-amber-600" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Star size={11} />
            Starred
          </button>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
              Categories
            </p>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-md transition-colors mb-0.5 ${
                !selectedCategory
                  ? "bg-slate-100 text-slate-800 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>All</span>
              <span className="text-slate-400">{docs.filter((d) => !favFilter || d.is_favorite).length}</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-md transition-colors mb-0.5 ${
                  selectedCategory === cat
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{cat}</span>
                <span className="text-slate-400 shrink-0 ml-1">{catCount(cat)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Doc list */}
        <div className="flex-1 p-3 overflow-y-auto">
          {visibleDocs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No guides yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {visibleDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg text-xs transition-colors group ${
                    selectedDoc?.id === doc.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FileText size={12} className="shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{doc.title}</span>
                  {doc.is_favorite && (
                    <Star size={10} className="shrink-0 fill-amber-400 text-amber-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {selectedDoc ? (
          <div className="p-8 max-w-3xl">
            {/* Doc header */}
            <div className="flex items-start justify-between mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-slate-900">{selectedDoc.title}</h1>
                {selectedDoc.category && (
                  <span className="inline-block mt-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                    {selectedDoc.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleFavorite(selectedDoc.id)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    selectedDoc.is_favorite
                      ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                  }`}
                  title={selectedDoc.is_favorite ? "Unstar" : "Star"}
                >
                  <Star size={16} className={selectedDoc.is_favorite ? "fill-amber-400" : ""} />
                </button>
                <button
                  onClick={() => openEdit(selectedDoc)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleteId(selectedDoc.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Markdown content */}
            {selectedDoc.content ? (
              <MarkdownBody content={selectedDoc.content} />
            ) : (
              <p className="text-slate-400 text-sm italic">No content yet. Click edit to add some.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
              <FileText size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium mb-1">Select a guide</p>
            <p className="text-slate-400 text-sm">
              {docs.length === 0
                ? "Add your first guide using the button on the left."
                : "Pick a guide from the sidebar to read it."}
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editDoc !== null) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editDoc ? "Edit Guide" : "New Guide"}
            </h2>
            <form onSubmit={saveDoc} className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    required
                    placeholder="e.g. Git Cheatsheet"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    list={datalistId}
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    placeholder="e.g. DevOps"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id={datalistId}>
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content{" "}
                  <span className="text-slate-400 font-normal">(Markdown supported — paste a YouTube URL on its own line to embed it)</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setField("content", e.target.value)}
                  placeholder="Write your guide in Markdown..."
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono min-h-[280px]"
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
                  {editDoc ? "Save changes" : "Save"}
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
            <h2 className="text-base font-semibold text-slate-900 mb-1">Delete guide?</h2>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this guide.</p>
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
