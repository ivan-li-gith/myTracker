"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WorkLogEntry, Category } from "@/lib/types";

interface Props {
  entry: WorkLogEntry;
  categories: Category[];
  onAddCategory: (name: string) => Promise<Category>;
  onDeleteCategory: (id: number) => void;
  onSaved: (entry: WorkLogEntry) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export default function EditWorkLogModal({ entry, categories, onAddCategory, onDeleteCategory, onSaved, onDeleted, onClose }: Props) {
  const [startTime, setStartTime] = useState(entry.start_time);
  const [endTime, setEndTime] = useState(entry.end_time);
  const [category, setCategory] = useState(entry.category);
  const [description, setDescription] = useState(entry.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function handleAddCategory() {
    const name = newCategoryInput.trim();
    if (!name) return;
    setCategoryError(null);
    try {
      const created = await onAddCategory(name);
      setCategory(created.name);
      setNewCategoryInput("");
      setAddingCategory(false);
    } catch {
      setCategoryError("Category already exists or could not be saved.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated = await apiFetch(`/work-log/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          category,
          description: description || null,
        }),
      });
      onSaved(updated);
    } catch (error) {
      console.error("Error updating entry:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiFetch(`/work-log/${entry.id}`, { method: "DELETE" });
      onDeleted(entry.id);
    } catch (error) {
      console.error("Error deleting entry:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Edit Entry</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors disabled:opacity-50"
              aria-label="Delete entry"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                autoFocus
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Category</label>
              {!addingCategory && (
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  <Plus size={12} /> New
                </button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {addingCategory && (
              <div className="mt-2 border border-slate-100 rounded-lg p-2 flex flex-col gap-1">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 group">
                    <span className="text-sm text-slate-700">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus
                    className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="Category name"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); }
                      if (e.key === "Escape") { setAddingCategory(false); setNewCategoryInput(""); }
                    }}
                  />
                  <button type="button" onClick={handleAddCategory} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">Add</button>
                  <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryInput(""); setCategoryError(null); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
                </div>
                {categoryError && <p className="text-xs text-red-500 px-2">{categoryError}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">What did you do?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you worked on..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
